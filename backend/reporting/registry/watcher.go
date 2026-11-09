package registry

import (
	"context"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const defaultWatchDebounce = 30 * time.Second

type WatchOption func(*Watcher)

func WithWatchDebounce(delay time.Duration) WatchOption {
	return func(watcher *Watcher) {
		if delay > 0 {
			watcher.debounce = delay
		}
	}
}

// Watcher reloads a Loader after reporting YAML or JSON asset changes. Loader retains the
// last valid registry, so a partially written or invalid asset never replaces
// the report definitions currently being served.
type Watcher struct {
	loader   *Loader
	debounce time.Duration

	mu         sync.Mutex
	cancel     context.CancelFunc
	generation uint64
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

// Start begins recursive observation and returns after the initial metadata snapshot.
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

	previous, err := reportingStamps(ctx, root)
	if err != nil {
		return err
	}
	w.mu.Lock()
	if w.cancel != nil {
		w.mu.Unlock()
		return fmt.Errorf("reporting watcher already started")
	}
	ctx, cancel := context.WithCancel(ctx)
	w.cancel = cancel
	w.generation++
	generation := w.generation
	w.mu.Unlock()
	go func() {
		defer func() {
			w.mu.Lock()
			if w.generation == generation {
				w.cancel = nil
			}
			w.mu.Unlock()
			cancel()
		}()
		ticker := time.NewTicker(w.debounce)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				next, err := reportingStamps(ctx, root)
				if ctx.Err() != nil {
					return
				}
				if err != nil {
					if onReload != nil {
						onReload(w.loader.Current(), err)
					}
					continue
				}
				if maps.Equal(previous, next) {
					continue
				}
				previous = next
				current, err := w.loader.Reload(ctx)
				if onReload != nil && ctx.Err() == nil {
					onReload(current, err)
				}
			}
		}
	}()
	return nil
}

func (w *Watcher) Close() error {
	if w != nil {
		w.mu.Lock()
		if w.cancel != nil {
			w.cancel()
			w.cancel = nil
		}
		w.mu.Unlock()
	}
	return nil
}

type assetStamp struct {
	modified time.Time
	size     int64
}

func reportingStamps(ctx context.Context, root string) (map[string]assetStamp, error) {
	stamps := map[string]assetStamp{}
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if err = ctx.Err(); err != nil {
			return err
		}
		if entry.Type()&os.ModeSymlink != 0 || entry.IsDir() || !isReportingAsset(root, path) {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		stamps[path] = assetStamp{info.ModTime(), info.Size()}
		return nil
	})
	return stamps, err
}

func isReportingAsset(root, filename string) bool {
	if !pathWithin(root, filename) {
		return false
	}
	extension := strings.ToLower(filepath.Ext(filename))
	return extension == ".yaml" || extension == ".yml" || extension == ".json"
}
