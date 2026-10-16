// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/types"
	"io"
	"strings"
)

func decodePagingBackendJSON(raw []byte, target interface{}, ds *types.DataSource) error {
	if ds == nil || ds.Paging == nil || !ds.Paging.Enabled || strings.TrimSpace(ds.Paging.Mode) == "" {
		return json.Unmarshal(raw, target)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var extra interface{}
	if err := decoder.Decode(&extra); err != io.EOF {
		return fmt.Errorf("datasource JSON must contain one value")
	}
	return nil
}
