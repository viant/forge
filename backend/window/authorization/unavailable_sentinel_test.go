// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"errors"
	"fmt"
	"github.com/viant/authz"
	"testing"
)

func TestUnavailableSentinelRetainsPublicAuthorizationClassification(t *testing.T) {
	wrapped := fmt.Errorf("dependency context: %w", ErrUnavailable)
	if !errors.Is(wrapped, ErrUnavailable) || !errors.Is(wrapped, authz.ErrUnavailable) {
		t.Fatal("trusted public availability classification lost")
	}
	if errors.Is(errors.New(ErrUnavailable.Error()), ErrUnavailable) || errors.Is(errors.New(ErrUnavailable.Error()), authz.ErrUnavailable) {
		t.Fatal("error text acquired trusted availability classification")
	}
}
