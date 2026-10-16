// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"fmt"
	"strconv"

	"github.com/viant/authz"
)

// OpaqueAccountProjection retains a verified string identity for generic
// tenants. Hosts with a legacy numeric account vocabulary may choose the
// numeric projection instead; neither projection grants authority.
func OpaqueAccountProjection(_ context.Context, _ authz.Facts, accountID string) (map[string]any, error) {
	if accountID == "" {
		return nil, fmt.Errorf("account ID is required")
	}
	return map[string]any{"id": accountID}, nil
}

func NumericAccountProjection(_ context.Context, _ authz.Facts, accountID string) (map[string]any, error) {
	value, err := strconv.ParseInt(accountID, 10, 64)
	if err != nil || value <= 0 || value > 1<<53-1 || strconv.FormatInt(value, 10) != accountID {
		return nil, fmt.Errorf("account ID is not a safe canonical integer")
	}
	return map[string]any{"id": value}, nil
}
