// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package codec

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/viant/afs"
	"github.com/viant/afs/storage"
	"gopkg.in/yaml.v3"
)

// DecodeData decodes YAML or JSON bytes into out based on the supplied path.
// Non-JSON extensions default to YAML.
func DecodeData(location string, data []byte, out interface{}) error {
	if out == nil {
		return fmt.Errorf("decode target is nil")
	}
	switch target := out.(type) {
	case *yaml.Node:
		return yaml.Unmarshal(data, target)
	default:
		switch strings.ToLower(path.Ext(location)) {
		case ".json":
			return json.Unmarshal(data, out)
		default:
			return yaml.Unmarshal(data, out)
		}
	}
}

// DecodeFile reads a local YAML/JSON resource file and decodes it into out.
func DecodeFile(filename string, out interface{}) error {
	data, err := os.ReadFile(filepath.Clean(filename))
	if err != nil {
		return err
	}
	return DecodeData(filename, data, out)
}

// DecodeURL reads a filesystem-backed YAML/JSON resource and decodes it into out.
func DecodeURL(ctx context.Context, fs afs.Service, url string, out interface{}, options ...storage.Option) error {
	data, err := fs.DownloadWithURL(ctx, url, options...)
	if err != nil {
		return err
	}
	return DecodeData(url, data, out)
}
