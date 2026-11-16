// SPDX-License-Identifier: Apache-2.0
package catalog

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math/big"
	"slices"
	"strings"

	identity "github.com/viant/forge/backend/resource"
)

// ScopeFilter selects a producer-declared scope parameter in one namespace.
// For a multi-select value any shared member matches. Numbers, booleans and
// strings are distinct. The filter only narrows authorized discovery results.
type ScopeFilter struct {
	Key   string          `json:"key" description:"Exact parameter ID declared by the report scope."`
	Value json.RawMessage `json:"value" description:"A JSON string, number or boolean, or an array of those values; any shared member matches."`
}

type ScopeValues map[string][]string

// numberKey normalizes the coefficient and exponent without expanding either
// into zeros. Thus 1.0 == 1e0 while large integer identifiers remain exact.
func numberKey(raw string) string {
	digits, expText, _ := strings.Cut(strings.ToLower(raw), "e")
	negative := strings.HasPrefix(digits, "-")
	digits = strings.TrimPrefix(digits, "-")
	whole, frac, _ := strings.Cut(digits, ".")
	digits = strings.TrimLeft(whole+frac, "0")
	if digits == "" {
		return "n:0"
	}
	coefficient := strings.TrimRight(digits, "0")
	delta := int64(len(digits) - len(coefficient) - len(frac))
	var exponent big.Int
	if expText != "" {
		exponent.SetString(expText, 10)
	}
	exponent.Add(&exponent, big.NewInt(delta))
	if negative {
		coefficient = "-" + coefficient
	}
	if exponent.Sign() == 0 {
		return "n:" + coefficient
	}
	return "n:" + coefficient + "e" + exponent.String()
}

func scalarKey(raw json.RawMessage) (string, bool) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return "", false
	}
	switch raw[0] {
	case '"':
		var s string
		if json.Unmarshal(raw, &s) == nil {
			return "s:" + s, true
		}
	case 't', 'f':
		if string(raw) == "true" || string(raw) == "false" {
			return "b:" + string(raw), true
		}
	case '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
		// Producer JSON is already decoded. Do not convert exact numeric IDs to float64.
		if json.Valid(raw) {
			return numberKey(string(raw)), true
		}
	}
	return "", false
}

func scopeKeys(raw json.RawMessage) []string {
	if key, ok := scalarKey(raw); ok {
		return []string{key}
	}
	var values []json.RawMessage
	if json.Unmarshal(raw, &values) != nil {
		return nil
	}
	keys := make([]string, 0, len(values))
	for _, v := range values {
		key, ok := scalarKey(v)
		if !ok {
			return nil
		}
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return slices.Compact(keys)
}

// ScopeProjection reads only the producer’s declared parameter IDs and values.
type ScopeProjection struct {
	Scope *struct {
		Params []struct {
			ID    string          `json:"id"`
			Value json.RawMessage `json:"value"`
		} `json:"params"`
	} `json:"scope"`
}

func (p ScopeProjection) Values() ScopeValues {
	if p.Scope == nil {
		return nil
	}
	var out ScopeValues
	for _, param := range p.Scope.Params {
		if param.ID == "" {
			continue
		}
		if values := scopeKeys(param.Value); len(values) > 0 {
			if out == nil {
				out = ScopeValues{}
			}
			out[param.ID] = values
		}
	}
	return out
}

func DeclaredScopeValues(spec, document json.RawMessage) ScopeValues {
	for _, raw := range []json.RawMessage{spec, document} {
		if len(raw) == 0 {
			continue
		}
		var projection ScopeProjection
		if json.Unmarshal(raw, &projection) != nil {
			return nil
		}
		if projection.Scope != nil {
			return projection.Values()
		}
	}
	return nil
}

type PreparedScope struct {
	key          string
	values       []string
	cursorPrefix string
}

func (s *ScopeFilter) Prepare(namespace string) (*PreparedScope, error) {
	if s == nil {
		return nil, nil
	}
	values := scopeKeys(s.Value)
	if strings.TrimSpace(namespace) == "" || strings.TrimSpace(s.Key) == "" || s.Key != strings.TrimSpace(s.Key) || len(values) == 0 {
		return nil, identity.ErrResource
	}
	data, _ := json.Marshal([]any{namespace, s.Key, values})
	sum := sha256.Sum256(data)
	return &PreparedScope{key: s.Key, values: values, cursorPrefix: hex.EncodeToString(sum[:]) + ":"}, nil
}

func (s *PreparedScope) Cursor(encoded string) (string, error) {
	if s == nil || encoded == "" {
		return encoded, nil
	}
	raw, ok := strings.CutPrefix(encoded, s.cursorPrefix)
	if !ok || raw == "" {
		return "", identity.ErrResource
	}
	return raw, nil
}
func (s *PreparedScope) Next(cursor string) string {
	if s == nil || cursor == "" {
		return cursor
	}
	return s.cursorPrefix + cursor
}
func (s *PreparedScope) Matches(values ScopeValues) bool {
	if s == nil {
		return true
	}
	for _, stored := range values[s.key] {
		if slices.Contains(s.values, stored) {
			return true
		}
	}
	return false
}
