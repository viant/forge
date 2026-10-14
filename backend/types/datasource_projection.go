package types

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
	"slices"
	"strings"
)

// ProjectNativeDataSource is the native browser fetch-envelope projection.
// Producer backend/cache and access provenance are not browser bindings.
func ProjectNativeDataSource(id string, source DataSource) DataSource {
	if source.Service != nil {
		return source
	}
	source.Service = &Service{Endpoint: "agentlyAPI", URI: "/v1/api/datasources/" + id + "/fetch", Method: "POST"}
	selectors := Selectors{}
	if source.Selectors != nil {
		selectors = *source.Selectors
		selectors.DataFallbacks = slices.Clone(selectors.DataFallbacks)
	}
	if strings.TrimSpace(selectors.Data) == "" || selectors.Data == "data" {
		selectors.Data = "rows"
	}
	if strings.TrimSpace(selectors.DataInfo) == "" || selectors.DataInfo == "meta" {
		selectors.DataInfo = "dataInfo"
	}
	source.Selectors = &selectors
	return source
}

// CompileWindowDataSource uses precisely the same typed native projection, but
// retains unknown preexisting runtime extensions. The caller retains the full
// descriptor, targets and authority references in its original document.
func CompileWindowDataSource(id string, descriptor, previous json.RawMessage) (json.RawMessage, error) {
	return CompileWindowDataSourceAgainst(id, descriptor, nil, previous)
}
func CompileWindowDataSourceAgainst(id string, descriptor, previousDescriptor, previous json.RawMessage) (json.RawMessage, error) {
	var header struct {
		ID string `json:"id"`
	}
	if json.Unmarshal(descriptor, &header) != nil || header.ID != id || id == "" {
		return nil, fmt.Errorf("datasource identity does not match its logical binding")
	}
	var source DataSource
	decoder := json.NewDecoder(bytes.NewReader(descriptor))
	decoder.UseNumber()
	if err := decoder.Decode(&source); err != nil {
		return nil, err
	}
	source = ProjectNativeDataSource(id, source)
	raw, err := json.Marshal(source)
	if err != nil {
		return nil, err
	}
	var generated, prior map[string]json.RawMessage
	if json.Unmarshal(raw, &generated) != nil {
		return nil, fmt.Errorf("invalid projected datasource")
	}
	if len(previous) > 0 && json.Unmarshal(previous, &prior) != nil {
		return nil, fmt.Errorf("invalid previous datasource projection")
	}
	known := map[string]bool{}
	t := reflect.TypeOf(DataSource{})
	for i := 0; i < t.NumField(); i++ {
		tag := strings.Split(t.Field(i).Tag.Get("json"), ",")[0]
		if tag != "" && tag != "-" {
			known[tag] = true
		}
	}
	var before, edited map[string]json.RawMessage
	_ = json.Unmarshal(previousDescriptor, &before)
	_ = json.Unmarshal(descriptor, &edited)
	for key, value := range prior {
		_, wasDeclared := before[key]
		_, isDeclared := edited[key]
		if !known[key] || len(previousDescriptor) > 0 && !wasDeclared && !isDeclared {
			generated[key] = value
		}
	}
	return json.Marshal(generated)
}
