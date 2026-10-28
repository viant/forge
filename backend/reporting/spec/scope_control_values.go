package reportspec

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"
)

// ValidateScopeParamValue admits values representable by the native browser
// control contract. Exact large IDs need a declared string producer input;
// silently coercing numeric controls to strings would change query semantics.
func ValidateScopeParamValue(param ScopeParam) error {
	normalize := func(value any) (any, error) {
		encoded, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}
		decoder := json.NewDecoder(bytes.NewReader(encoded))
		decoder.UseNumber()
		var result any
		err = decoder.Decode(&result)
		return result, err
	}
	value, err := normalize(param.Value)
	if err != nil {
		return fmt.Errorf("scope control %q: %w", param.ID, err)
	}
	if param.Required {
		missing := value == nil || value == ""
		if list, ok := value.([]any); ok && len(list) == 0 {
			missing = true
		}
		if missing {
			return fmt.Errorf("required scope control %q needs a nonempty default", param.ID)
		}
	}
	max := new(big.Rat).SetInt64(9007199254740991)
	var check func(any) error
	check = func(value any) error {
		switch item := value.(type) {
		case json.Number:
			text := item.String()
			if len(text) > 128 {
				return fmt.Errorf("scope control %q numeric value exceeds supported browser precision", param.ID)
			}
			if _, exponent, has := strings.Cut(strings.ToLower(text), "e"); has {
				power, err := strconv.Atoi(exponent)
				if err != nil || power < -1024 || power > 1024 {
					return fmt.Errorf("scope control %q numeric exponent exceeds supported browser range", param.ID)
				}
			}
			number, ok := new(big.Rat).SetString(text)
			if !ok || number.Abs(number).Cmp(max) > 0 {
				return fmt.Errorf("scope control %q numeric value exceeds JavaScript safe range; use a declared string input", param.ID)
			}
		case []any:
			for _, child := range item {
				if err := check(child); err != nil {
					return err
				}
			}
		case map[string]any:
			for _, child := range item {
				if err := check(child); err != nil {
					return err
				}
			}
		}
		return nil
	}
	if err = check(value); err != nil {
		return err
	}
	for _, option := range param.Options {
		value, err := normalize(option.Value)
		if err != nil {
			return err
		}
		if err = check(value); err != nil {
			return err
		}
	}
	return nil
}
