package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/viant/afs"
	"github.com/viant/forge/backend/service/meta"
	"gopkg.in/yaml.v3"
)

// ResolveBuilderDataSources materializes referenced workspace descriptor bytes
// for trusted imports. It reads configuration only; no datasource is executed.
func ResolveBuilderDataSources(ctx context.Context, workspaceRoot string, builder *Asset) (map[string]json.RawMessage, error) {
	if ctx == nil || ctx.Err() != nil || builder == nil {
		return nil, fmt.Errorf("report builder descriptor context required")
	}
	refs := map[string]bool{}
	var visit func(any)
	visit = func(value any) {
		switch item := value.(type) {
		case map[string]any:
			for key, child := range item {
				if strings.HasSuffix(strings.ToLower(key), "datasourceref") {
					if id, ok := child.(string); ok && strings.TrimSpace(id) != "" {
						refs[strings.TrimSpace(id)] = true
					}
				}
				visit(child)
			}
		case []any:
			for _, child := range item {
				visit(child)
			}
		}
	}
	visit(builder.Raw)
	if len(refs) == 0 {
		return map[string]json.RawMessage{}, nil
	}
	root, err := filepath.Abs(workspaceRoot)
	if err != nil {
		return nil, err
	}
	directory := filepath.Join(root, "extension", "forge", "datasources")
	paths := map[string]string{}
	err = filepath.WalkDir(directory, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		extension := strings.ToLower(filepath.Ext(path))
		if extension != ".yaml" && extension != ".yml" {
			return nil
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		var header struct {
			ID string `yaml:"id"`
		}
		if yaml.Unmarshal(raw, &header) != nil {
			return nil
		}
		if header.ID != "" {
			if paths[header.ID] != "" {
				return fmt.Errorf("duplicate datasource descriptor identity")
			}
			paths[header.ID] = path
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	loader := meta.New(afs.New(), root)
	result := map[string]json.RawMessage{}
	queue := make([]string, 0, len(refs))
	for id := range refs {
		queue = append(queue, id)
	}
	for index := 0; index < len(queue); index++ {
		id := queue[index]
		if result[id] != nil {
			continue
		}
		path := paths[id]
		if path == "" {
			return nil, fmt.Errorf("report datasource %q unavailable", id)
		}
		var descriptor map[string]any
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return nil, err
		}
		if err := loader.Load(ctx, filepath.ToSlash(relative), &descriptor); err != nil {
			return nil, err
		}
		raw, err := json.Marshal(descriptor)
		if err != nil {
			return nil, err
		}
		result[id] = raw
		before := len(refs)
		visit(descriptor)
		if len(refs) > before {
			for ref := range refs {
				if result[ref] == nil {
					queue = append(queue, ref)
				}
			}
		}
	}
	return result, nil
}
