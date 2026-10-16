package datasource

import "testing"

func TestMCPMethodVariantsConditions(t *testing.T) {
	b := &Backend{Kind: BackendMCPTool, Service: "producer", Method: "list", MethodVariants: []MCPMethodVariant{{Method: "byKey", When: MCPMethodCondition{Parameter: "Keys", NonEmpty: true}}}}
	for _, test := range []struct {
		value  interface{}
		method string
	}{{nil, "list"}, {[]int{}, "list"}, {"   ", "list"}, {[]int{7}, "byKey"}, {0, "byKey"}, {false, "byKey"}} {
		got, err := b.ResolveMCPMethod(map[string]interface{}{"Keys": test.value, "method": "arbitrary"})
		if err != nil || got != test.method {
			t.Fatalf("%#v: %s %v", test.value, got, err)
		}
	}
	b.MethodVariants = append(b.MethodVariants, MCPMethodVariant{Method: "byOther", When: MCPMethodCondition{Parameter: "Other", NonEmpty: true}})
	if _, err := b.ResolveMCPMethod(map[string]interface{}{"Keys": []int{1}, "Other": []int{2}}); err == nil {
		t.Fatal("ambiguous selection accepted")
	}
	for _, variant := range []MCPMethodVariant{{Method: "", When: MCPMethodCondition{Parameter: "Keys", NonEmpty: true}}, {Method: "list", When: MCPMethodCondition{Parameter: "Keys", NonEmpty: true}}, {Method: "read", When: MCPMethodCondition{Parameter: "nested.Keys", NonEmpty: true}}, {Method: "read", When: MCPMethodCondition{Parameter: "Keys"}}} {
		b.MethodVariants = []MCPMethodVariant{variant}
		if _, err := b.DeclaredMCPMethods(); err == nil {
			t.Fatalf("invalid declaration accepted: %#v", variant)
		}
	}
	b.MethodVariants = []MCPMethodVariant{{Method: "byKey", When: MCPMethodCondition{Parameter: "Keys", NonEmpty: true}}}
	b.Kind = BackendInline
	if _, err := b.DeclaredMCPMethods(); err == nil {
		t.Fatal("variants accepted on non-MCP backend")
	}
}
