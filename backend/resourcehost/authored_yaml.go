// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package resource

import (
	"bytes"

	"io"

	identity "github.com/viant/forge/backend/resource"

	"gopkg.in/yaml.v3"
)

func strictAuthoredYAML(raw []byte, target any) error {
	d := yaml.NewDecoder(bytes.NewReader(raw))
	d.KnownFields(true)
	if err := d.Decode(target); err != nil {
		return err
	}
	if d.Decode(new(any)) != io.EOF {
		return identity.ErrResource
	}
	return nil
}
