package window

import (
	"context"
	"github.com/viant/afs"
	"github.com/viant/afs/storage"
	"github.com/viant/forge/backend/window/source/internal/meta"
	"gopkg.in/yaml.v3"
)

// ResolveSourceImports resolves authored YAML imports through the host-supplied
// filesystem. Confined hosts provide a reader that rejects paths outside their
// admitted source snapshot.
func ResolveSourceImports(ctx context.Context, filesystem afs.Service, node *yaml.Node, baseDirectory string, options ...storage.Option) error {
	return meta.ResolveImports(ctx, filesystem, node, baseDirectory, options...)
}
