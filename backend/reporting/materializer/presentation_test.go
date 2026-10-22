package materializer

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestPresentSelectedMetricsPreservesQueriesAndPrintsSelection(t *testing.T) {
	spec, err := os.ReadFile("testdata/presentation-report.json")
	if err != nil {
		t.Fatal(err)
	}
	var before struct {
		Datasets json.RawMessage `json:"datasets"`
		Blocks   []struct {
			ID   string `json:"id"`
			Kind string `json:"kind"`
		} `json:"blocks"`
	}
	if err = json.Unmarshal(spec, &before); err != nil {
		t.Fatal(err)
	}
	chartID := ""
	for _, block := range before.Blocks {
		if block.Kind == "chartBlock" {
			chartID = block.ID
		}
	}
	if chartID == "" {
		t.Fatal("synthetic chart missing")
	}
	presented, err := Present(context.Background(), spec, map[string]ChartMetricSelection{chartID: {PrimaryField: "count", SecondaryField: "rate"}})
	if err != nil {
		t.Fatal(err)
	}
	var after struct {
		Datasets json.RawMessage `json:"datasets"`
		Blocks   []struct {
			ID         string `json:"id"`
			ChartModel struct {
				Series struct {
					Values []struct {
						Value string `json:"value"`
					} `json:"values"`
				} `json:"series"`
			} `json:"chartModel"`
		} `json:"blocks"`
	}
	if err = json.Unmarshal(presented, &after); err != nil {
		t.Fatal(err)
	}
	var queriesBefore, queriesAfter interface{}
	_ = json.Unmarshal(before.Datasets, &queriesBefore)
	_ = json.Unmarshal(after.Datasets, &queriesAfter)
	if !reflect.DeepEqual(queriesBefore, queriesAfter) {
		t.Fatal("presentation changed admitted datasource arguments")
	}
	for _, block := range after.Blocks {
		if block.ID == chartID {
			if len(block.ChartModel.Series.Values) != 2 || block.ChartModel.Series.Values[0].Value != "count" {
				t.Fatal("viewer choice was lost")
			}
		}
	}
	artifacts, err := Materialize(context.Background(), presented, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"day":"one","spend":10,"count":1000,"rate":0.01},{"day":"two","spend":20,"count":2000,"rate":0.02}]}`)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(artifacts.ReportPrint), "Impressions") || !strings.Contains(string(artifacts.ReportPrint), "2.00%") {
		t.Fatal("print did not retain selected metrics")
	}
	for _, choice := range []map[string]ChartMetricSelection{{"unknown": {PrimaryField: "count", SecondaryField: "rate"}}, {chartID: {PrimaryField: "secret", SecondaryField: "rate"}}, {chartID: {PrimaryField: "count", SecondaryField: "count"}}} {
		if _, err := Present(context.Background(), spec, choice); err == nil {
			t.Fatal("unapproved presentation accepted", choice)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := Present(ctx, spec, nil); !errors.Is(err, context.Canceled) {
		t.Fatal("parent cancellation lost", err)
	}
}
