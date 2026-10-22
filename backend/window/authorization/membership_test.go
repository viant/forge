package permittedview

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPresentationScopeReusesMembershipAndRecapturesChangedFacts(t *testing.T) {
	roles := []string{"reader"}
	snapshot := &Snapshot{Principal: map[string]any{"roles": roles, "features": []string{"FEATURE"}, "exposures": []string{"REPORTS_UI"}, "userAuthorities": []string{"LEGACY_ROLE"}}}
	before, err := json.Marshal(snapshot)
	require.NoError(t, err)
	scope := authorizationScope(snapshot, nil)
	membership := scope.membership
	for n := 0; n < 3000; n++ {
		for field, expected := range map[string]string{"principal.roles": "reader", "principal.features": "FEATURE", "principal.exposures": "REPORTS_UI", "principal.userAuthorities": "LEGACY_ROLE"} {
			require.True(t, evaluateAuthorizationLeaf(map[string]any{"field": field, "contains": expected}, scope))
		}
	}
	require.Same(t, membership, scope.membership)
	conditionCheck := map[string]any{"field": "principal.roles", "contains": "reader"}
	require.Zero(t, testing.AllocsPerRun(3000, func() {
		if !evaluateAuthorizationLeaf(conditionCheck, scope) {
			panic("lost role membership")
		}
	}), "repeated indexed guards must not rebuild maps or allocate")
	after, err := json.Marshal(snapshot)
	require.NoError(t, err)
	require.Equal(t, before, after, "indexing must preserve public arrays")
	roles[0] = "editor"
	condition := map[string]any{"source": "authorization", "field": "principal.roles", "contains": "reader"}
	require.True(t, evaluateAuthorizationLeaf(condition, scope), "captured projection is detached from mutable inputs")
	current, err := EvaluateAuthorizationCondition(condition, snapshot, nil)
	require.NoError(t, err)
	require.False(t, current, "a later projection must recapture mutations")
	snapshot.Principal = map[string]any{"roles": []string{"reader"}, "exposures": []string{"REPLACED_UI"}}
	replacement := authorizationScope(snapshot, nil)
	require.True(t, evaluateAuthorizationLeaf(condition, replacement))
	require.False(t, evaluateAuthorizationLeaf(map[string]any{"field": "principal.exposures", "contains": "REPORTS_UI"}, replacement))
	require.True(t, evaluateAuthorizationLeaf(map[string]any{"field": "principal.exposures", "contains": "REPLACED_UI"}, replacement))
}

func TestIndexedDisplayContainsRetainsOtherOperatorSemantics(t *testing.T) {
	scope := authorizationScope(&Snapshot{Principal: map[string]any{"roles": []string{"reader", "editor"}, "label": "reader operator", "numbers": []int{1, 2}}}, nil)
	for _, condition := range []map[string]any{
		{"field": "principal.roles", "equals": []any{"reader", "editor"}},
		{"field": "principal.roles", "notEquals": []any{"other"}},
		{"field": "principal.roles", "notEmpty": true},
		{"field": "principal.label", "contains": "operator"},
		{"field": "principal.numbers", "contains": float64(2)},
	} {
		require.True(t, evaluateAuthorizationLeaf(condition, scope), "%v", condition)
	}
}

func BenchmarkPresentationRoleMembership(b *testing.B) {
	roles := make([]string, 2048)
	for n := range roles {
		roles[n] = fmt.Sprintf("role-%d", n)
	}
	scope := authorizationScope(&Snapshot{Principal: map[string]any{"roles": roles}}, nil)
	condition := map[string]any{"field": "principal.roles", "contains": roles[len(roles)-1]}
	actual, _ := selectValue(scope.values, "principal.roles")
	expected := condition["contains"]
	b.Run("indexed-repeated-guard", func(b *testing.B) {
		b.ReportAllocs()
		for n := 0; n < b.N; n++ {
			if !evaluateAuthorizationLeaf(condition, scope) {
				b.Fatal("role missing")
			}
		}
	})
	b.Run("linear-repeated-guard", func(b *testing.B) {
		b.ReportAllocs()
		for n := 0; n < b.N; n++ {
			if !containsValue(actual, expected) {
				b.Fatal("role missing")
			}
		}
	})
}
