// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"

	xshape "github.com/viant/x/shape"
)

// Capture author configuration before cache lookup/backend execution. Aliases
// read the original row, never values synthesized by another alias.
func prepareResponseAliases(aliases map[string]string) (map[string]string, error) {
	result := make(map[string]string, len(aliases))
	for target, source := range aliases {
		for _, key := range []string{target, source} {
			if strings.TrimSpace(key) == "" {
				return nil, fmt.Errorf("responseAliases requires nonempty literal keys")
			}
			for _, part := range strings.FieldsFunc(key, func(r rune) bool { return r == '.' || r == '[' || r == ']' || r == '/' }) {
				if part == "__proto__" || part == "prototype" || part == "constructor" {
					return nil, fmt.Errorf("responseAliases key %q is reserved", key)
				}
			}
		}
		if _, chained := aliases[source]; chained && source != target {
			return nil, fmt.Errorf("responseAliases %q -> %q chains through an alias target", target, source)
		}
		result[target] = source
	}
	return result, nil
}

func responseAliasCacheKey(logicalKey string, aliases map[string]string) string {
	// encoding/json sorts string-map keys. Version the projection contract even
	// for an empty mapping; the logical request hash remains independently intact.
	payload, _ := json.Marshal(aliases)
	digest := sha256.Sum256(payload)
	return logicalKey + "|response-aliases-v1:" + hex.EncodeToString(digest[:])
}

func applyResponseAliases(rows []map[string]interface{}, aliases map[string]string) ([]map[string]interface{}, error) {
	if len(aliases) == 0 {
		return rows, nil
	}
	// The safe clone rejects unsupported mutable graphs. JSON encoding also
	// rejects cycles/nonfinite values instead of caching an unserializable result.
	cloned, err := (xshape.Runtime{}).CloneValue(rows)
	if err != nil {
		return nil, fmt.Errorf("clone response aliases: %w", err)
	}
	if _, err = json.Marshal(cloned); err != nil {
		return nil, fmt.Errorf("response aliases require JSON rows: %w", err)
	}
	result := cloned.([]map[string]interface{})
	for index, row := range result {
		for target, source := range aliases {
			value, present := row[source]
			if !present {
				continue
			}
			if existing, present := row[target]; present && !reflect.DeepEqual(existing, value) {
				return nil, fmt.Errorf("responseAliases row %d target %q conflicts with source %q", index, target, source)
			}
			row[target] = value
		}
	}
	return result, nil
}
