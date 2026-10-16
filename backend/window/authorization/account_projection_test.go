// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"testing"

	"github.com/viant/authz"
)

func TestAccountProjectionPreservesVerifiedVocabulary(t *testing.T) {
	numeric, err := NumericAccountProjection(context.Background(), authz.Facts{}, "21")
	if err != nil || numeric["id"] != int64(21) {
		t.Fatalf("numeric account: %+v %v", numeric, err)
	}
	opaque, err := OpaqueAccountProjection(context.Background(), authz.Facts{}, "account-west")
	if err != nil || opaque["id"] != "account-west" {
		t.Fatalf("opaque account: %+v %v", opaque, err)
	}
	for _, id := range []string{"021", "9007199254740993", "account-west", ""} {
		if _, err := NumericAccountProjection(context.Background(), authz.Facts{}, id); err == nil {
			t.Errorf("unsafe numeric account %q accepted", id)
		}
	}
}
