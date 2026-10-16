// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package resource

import (
	"context"

	"path"

	"github.com/viant/afs"
	"github.com/viant/afs/storage"

	identity "github.com/viant/forge/backend/resource"

	meta "github.com/viant/forge/backend/window/source"
	"gopkg.in/yaml.v3"
)

// Imports retain the existing authoring semantics, but every static read belongs
// to the same confined snapshot reader and therefore its generation guard.
type nativeImportReader struct {
	afs.Service
	reader *ExtensionReader
}

func (r *nativeImportReader) DownloadWithURL(ctx context.Context, location string, _ ...storage.Option) ([]byte, error) {
	location = path.Clean(location)
	if !extensionPath(location) {
		return nil, identity.ErrResourceDenied
	}
	return r.reader.ReadFile(ctx, location)
}

func resolveNativeAuthoredImports(ctx context.Context, r *ExtensionReader, file string, node *yaml.Node) error {
	return meta.ResolveSourceImports(ctx, &nativeImportReader{reader: r}, node, path.Dir(file))
}
