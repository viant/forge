package registry

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

const defaultWatchDebounce = 250 * time.Millisecond

type WatchOption func(*Watcher)

func WithWatchDebounce(delay time.Duration) WatchOption {
	return func(watcher *Watcher) {
		if delay > 0 {
			watcher.debounce = delay
		}
	}
}

// Watcher reloads a Loader after reporting YAML changes. Loader retains the
// last valid registry, so a partially written or invalid asset never replaces
// the report definitions currently being served.
type Watcher struct {
	loader   *Loader
	debounce time.Duration

	mu      sync.Mutex
	watcher *fsnotify.Watcher
}

func NewWatcher(loader *Loader, options ...WatchOption) *Watcher {
	result := &Watcher{loader: loader, debounce: defaultWatchDebounce}
	for _, option := range options {
		if option != nil {
			option(result)
		}
	}
	return result
}

// Start begins recursive observation and returns after watches are installed.
// onReload receives both successful registries and validation/watch errors.
func (w *Watcher) Start(ctx context.Context, onReload func(*Registry, error)) error {
	if w == nil || w.loader == nil {
		return nil
	}
	root, err := ResolveRoot(w.loader.options.WorkspaceRoot, w.loader.options.ReportingRoot)
	if err != nil {
		return err
	}
	if info, statErr := os.Stat(root); statErr != nil {
		if os.IsNotExist(statErr) {
			return fmt.Errorf("watch reporting root %q: root does not exist", root)
		}
		return fmt.Errorf("watch reporting root %q: %w", root, statErr)
	} else if !info.IsDir() {
		return fmt.Errorf("watch reporting root %q: not a directory", root)
	}

	fileWatcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("create reporting watcher: %w", err)
	}
	if err = addRecursiveReportingWatch(fileWatcher, root); err != nil {
		_ = fileWatcher.Close()
		return fmt.Errorf("watch reporting root %q: %w", root, err)
	}
	w.mu.Lock()
	if w.watcher != nil {
		w.mu.Unlock()
		_ = fileWatcher.Close()
		return fmt.Errorf("reporting watcher already started")
	}
	w.watcher = fileWatcher
	w.mu.Unlock()

	go w.loop(ctx, root, fileWatcher, onReload)
	return nil
}

func (w *Watcher) Close() error {
	if w == nil {
		return nil
	}
	w.mu.Lock()
	fileWatcher := w.watcher
	w.watcher = nil
	w.mu.Unlock()
	if fileWatcher == nil {
		return nil
	}
	return fileWatcher.Close()
}

func (w *Watcher) loop(ctx context.Context, root string, fileWatcher *fsnotify.Watcher, onReload func(*Registry, error)) {
	defer func() {
		w.mu.Lock()
		if w.watcher == fileWatcher {
			w.watcher = nil
		}
		w.mu.Unlock()
		_ = fileWatcher.Close()
	}()

	timer := time.NewTimer(time.Hour)
	if !timer.Stop() {
		<-timer.C
	}
	pending := false
	schedule := func() {
		if pending && !timer.Stop() {
			select {
			case <-timer.C:
			default:
			}
		}
		timer.Reset(w.debounce)
		pending = true
	}

	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-fileWatcher.Events:
			if !ok {
				return
			}
			if event.Has(fsnotify.Create) {
				if info, statErr := os.Stat(event.Name); statErr == nil && info.IsDir() {
					_ = addRecursiveReportingWatch(fileWatcher, event.Name)
					// The editor may have populated the directory before this event
					// was delivered, so rescan rather than waiting for a missed file event.
					schedule()
					continue
				}
			}
			if isReportingYAML(root, event.Name) && event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Remove|fsnotify.Rename) != 0 {
				schedule()
			}
		case <-timer.C:
			pending = false
			registry, reloadErr := w.loader.Reload(context.Background())
			if onReload != nil {
				onReload(registry, reloadErr)
			}
		case watchErr, ok := <-fileWatcher.Errors:
			if !ok {
				return
			}
			if onReload != nil {
				onReload(w.loader.Current(), fmt.Errorf("reporting watcher: %w", watchErr))
			}
		}
	}
}

func addRecursiveReportingWatch(watcher *fsnotify.Watcher, root string) error {
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.IsDir() {
			return watcher.Add(path)
		}
		return nil
	})
}

func isReportingYAML(root, filename string) bool {
	if !pathWithin(root, filename) {
		return false
	}
	extension := strings.ToLower(filepath.Ext(filename))
	return extension == ".yaml" || extension == ".yml"
}
