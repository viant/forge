// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package window

import (
	"context"
	"testing"
)

func TestDeclaredNativeProducerCannotDowngradeWhenTransportMissing(t *testing.T) {
	d, err := NewDeclaredComponentDispatcher([]string{"native"}, nil)
	if err != nil || !d.IsComponentProducer("native") || d.IsComponentProducer("arbitrary") {
		t.Fatal("producer declaration not preserved")
	}
	if _, err := d.ObserveComponent(context.Background(), "native", "read", ComponentBinding{}); err == nil {
		t.Fatal("missing transport fabricated observation")
	}
	if _, err := d.ExecuteComponent(context.Background(), "native", "read", ComponentBinding{}, nil); err == nil {
		t.Fatal("missing transport fell back")
	}
}
