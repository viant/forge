package materializer

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
)

func TestWindowBuilderPreparationUsesOfficialAdapter(t *testing.T) {
	input := WindowBuilderPreparation{
		Container:             json.RawMessage(`{"id":"builder","dataSourceRef":"approved","title":"Synthetic native window export"}`),
		Config:                json.RawMessage(`{"dataSourceRef":"approved","dimensions":[{"id":"region","key":"region","paramPath":"dimensions.region"}],"measures":[{"id":"count","key":"count","paramPath":"measures.count","default":true}],"result":{"defaultMode":"table"}}`),
		Selection:             json.RawMessage(`{"version":1,"containerId":"builder","state":{"selectedDimensions":["region"],"selectedMeasures":["count"],"viewMode":"table"}}`),
		AttachedDataSourceIDs: []string{"approved"},
	}
	output, err := PrepareWindowBuilder(context.Background(), input)
	if err != nil || output == nil || len(output.ReportDocument) == 0 || len(output.ReportSpec) == 0 {
		t.Fatalf("official preparation failed: %v", err)
	}
	input.Selection = json.RawMessage(`{"version":1,"containerId":"builder","state":{"selectedMeasures":["foreign"]}}`)
	if _, err = PrepareWindowBuilder(context.Background(), input); err == nil {
		t.Fatal("unknown field accepted")
	}
	input.Selection = json.RawMessage(`{"version":1,"containerId":"builder","state":{"rows":[{"fake":999}]}}`)
	if _, err = PrepareWindowBuilder(context.Background(), input); err == nil {
		t.Fatal("client data accepted")
	}
}

func TestWindowBuilderIdentityAndRequestMappingUseEmbeddedBundle(t *testing.T) {
	config := json.RawMessage(`{"dimensions":[{"id":"region","key":"region"}],"measures":[{"id":"count","key":"count"}],"dataSourceRef":"approved","runtimeFieldCatalog":{"enabled":true},"dataSources":[{"id":"primary","dataSourceRef":"approved","capabilities":{"inheritRuntimeFieldCatalog":true}}],"result":{"defaultMode":"table"},"request":{"definitionIdentity":{"fields":{"Entity":{"path":"entity","type":"singlePositiveInteger"},"Variant":{"path":"variant","type":"positiveInteger","resolveWhenAbsent":true},"Trial":{"path":"trial","type":"boolean"}}},"envelope":{"version":1,"fields":{"Body.entity":{"window":"Entity","type":"singlePositiveInteger"},"Body.variant":{"window":"Variant","type":"positiveInteger"},"Body.trial":{"window":"Trial","type":"boolean"},"Body.measures":{"query":"measures","type":"enabledNames"},"Body.limit":{"query":"limit","type":"positiveInteger"},"Body.offset":{"query":"offset","type":"nonNegativeInteger"}}}}}`)
	parameters := map[string]interface{}{"Entity": []interface{}{7}, "Trial": false}
	if err := ValidateWindowBuilderIdentity(context.Background(), config, parameters); err != nil {
		t.Fatal(err)
	}
	if err := ValidateWindowBuilderIdentity(context.Background(), config, map[string]interface{}{"Entity": []interface{}{7, 9}, "Trial": false}); err == nil {
		t.Fatal("multiple entity selection was accepted")
	}
	prepared, err := PrepareWindowBuilder(context.Background(), WindowBuilderPreparation{
		Container: json.RawMessage(`{"id":"builder","dataSourceRef":"approved"}`), Config: config,
		Selection:        json.RawMessage(`{"version":1,"containerId":"builder","state":{"selectedMeasures":["count"],"selectedDimensions":["region"]}}`),
		Definition:       json.RawMessage(`{"entity":7,"variant":8,"trial":false,"fieldCatalog":{"columns":[{"name":"region","role":"dimension"},{"name":"count","role":"measure"}]}}`),
		WindowParameters: parameters, AttachedDataSourceIDs: []string{"approved"},
	})
	if err != nil {
		t.Fatal(err)
	}
	builder, err := json.Marshal(map[string]interface{}{"reportBuilder": prepared.Config})
	if err != nil {
		t.Fatal(err)
	}
	mapped, err := MapBuilderRequest(context.Background(), builder, map[string]interface{}{"measures": map[string]interface{}{"count": true}, "limit": 5, "offset": 0}, "primary")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(mapped)
	var got, want interface{}
	_ = json.Unmarshal(raw, &got)
	_ = json.Unmarshal([]byte(`{"Body":{"entity":7,"variant":8,"trial":false,"measures":["count"],"limit":5,"offset":0}}`), &want)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("wrong native mapped arguments: %s", raw)
	}
}
