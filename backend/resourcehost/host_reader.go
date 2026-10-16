package resource

import (
	"context"
	"io/fs"
	"os"
)

// NewExtensionReader confines host compilation to an already opened root.
// The caller retains ownership of root and closes it after Close.
func NewExtensionReader(root *os.Root) *ExtensionReader              { return &ExtensionReader{root: root} }
func (r *ExtensionReader) CheckPath(path string) error               { return r.check(path) }
func (r *ExtensionReader) FS() fs.FS                                 { return r.root.FS() }
func (r *ExtensionReader) Close()                                    { r.close() }
func ValidExtensionPath(path string) bool                            { return extensionPath(path) }
func DefinitionScopeFromContext(ctx context.Context) DefinitionScope { return definitionScope(ctx) }
