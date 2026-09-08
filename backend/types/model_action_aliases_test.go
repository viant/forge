package types

import (
	"encoding/json"
	"reflect"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestWindowActionAliasesRoundTrip(t *testing.T) {
	for name, payload := range map[string][]byte{
		"yaml": []byte("namespace: Campaign List\nactionRefs: [advertiser/shared/main]\nactionAliases: [Advertiser Workspace]\n"),
		"json": []byte(`{"namespace":"Campaign List","actionRefs":["advertiser/shared/main"],"actionAliases":["Advertiser Workspace"]}`),
	} {
		t.Run(name, func(t *testing.T) {
			window := &Window{}
			var err error
			if name == "yaml" {
				err = yaml.Unmarshal(payload, window)
			} else {
				err = json.Unmarshal(payload, window)
			}
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(window.ActionAliases, []string{"Advertiser Workspace"}) {
				t.Fatalf("actionAliases = %#v", window.ActionAliases)
			}
			if !reflect.DeepEqual(window.ActionRefs, []string{"advertiser/shared/main"}) {
				t.Fatalf("actionRefs = %#v", window.ActionRefs)
			}
		})
	}
}
