package artifactcohort

import "testing"

func TestPartitionHashesIsolateNamespaceAndKind(t *testing.T) {
	root := []RootRef{
		{URI: "intent://ops/main", Kind: "intent", Version: 1, Hash: "ops-intent-1"},
		{URI: "intent://sales/main", Kind: "intent", Version: 1, Hash: "sales-intent-1"},
		{URI: "window://sales/main", Kind: "window", Version: 1, Hash: "sales-window-1"},
	}
	m := Manifest{Cohorts: []Cohort{{Tenant: "tenant", Name: "operators", PolicyHash: "stable-policy", Roots: root}}}
	FillPartitionHashes(&m)
	before := m.PartitionHashes
	if got, err := RootPartition(root[1]); err != nil || got != PartitionKey("sales", "intent") {
		t.Fatalf("partition=%q %v", got, err)
	}
	m.Cohorts[0].Roots[1].Version = 2
	m.Cohorts[0].Roots[1].Hash = "sales-intent-2"
	FillPartitionHashes(&m)
	if m.PartitionHashes[PartitionKey("sales", "intent")] == before[PartitionKey("sales", "intent")] {
		t.Fatal("changed sales intent track did not advance")
	}
	for _, key := range []string{PartitionKey("sales", "window"), PartitionKey("ops", "intent"), PartitionKey("sales", "policy"), PartitionKey("ops", "policy")} {
		if m.PartitionHashes[key] != before[key] {
			t.Fatalf("unrelated partition %s changed", key)
		}
	}
}
