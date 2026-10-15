package materializer

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/dop251/goja"
	"github.com/viant/forge/backend/reporting/registry"
)

type stewardMaterializationGolden struct {
	ReportSpec  string `json:"reportSpec"`
	ReportFill  string `json:"reportFill"`
	ReportPrint string `json:"reportPrint"`
}

func TestStewardGojaMaterializationMatchesOfficialNodeOutput(t *testing.T) {
	paths, err := filepath.Glob("testdata/steward/*.json")
	if err != nil || len(paths) != 10 {
		t.Fatalf("expected ten actual Steward envelopes: %v count=%d", err, len(paths))
	}
	manifestBytes, err := os.ReadFile("testdata/steward_materialization/expected.json")
	if err != nil {
		t.Fatal(err)
	}
	var manifest map[string]stewardMaterializationGolden
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil || len(manifest) != len(paths) {
		t.Fatalf("invalid materialization golden manifest: %v", err)
	}
	for _, path := range paths {
		t.Run(filepath.Base(path), func(t *testing.T) {
			envelope, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			spec, err := lowerAtFixtureTime(t, envelope)
			if err != nil {
				t.Fatal(err)
			}
			datasetPath := filepath.Join("testdata/steward_materialization", filepath.Base(path))
			datasetBytes, err := os.ReadFile(datasetPath)
			if err != nil {
				t.Fatal(err)
			}
			var datasets map[string]json.RawMessage
			if err := json.Unmarshal(datasetBytes, &datasets); err != nil || len(datasets) == 0 {
				t.Fatalf("invalid fixture datasets: %v", err)
			}
			artifacts, err := materializeAtFixtureTime(t, spec, datasets)
			if err != nil {
				t.Fatal(err)
			}
			golden := manifest[filepath.Base(path)]
			if got := canonicalJSONSHA256(spec); got != golden.ReportSpec {
				t.Fatalf("ReportSpec parity mismatch: got=%s want=%s", got, golden.ReportSpec)
			}
			if got := canonicalJSONSHA256(artifacts.ReportFill); got != golden.ReportFill {
				t.Fatalf("ReportFill parity mismatch: got=%s want=%s", got, golden.ReportFill)
			}
			if got := rawJSONSHA256(artifacts.ReportPrint); got != golden.ReportPrint {
				t.Fatalf("ReportPrint parity mismatch: got=%s want=%s", got, golden.ReportPrint)
			}
		})
	}
}

var materializerFixtureTime = time.Date(2026, time.October, 7, 12, 0, 0, 0, time.UTC)

func lowerAtFixtureTime(t *testing.T, raw json.RawMessage) (json.RawMessage, error) {
	t.Helper()
	var envelope registry.ReportEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, err
	}
	if err := validateEnvelope(envelope); err != nil {
		return nil, err
	}
	programOnce.Do(func() { program, programError = goja.Compile("forge-authored-lowerer", bundle, true) })
	if programError != nil {
		return nil, programError
	}
	result, err := runEntryWithTimeSourceTimeout(context.Background(), program, "lower", raw, func() time.Time { return materializerFixtureTime }, 30*time.Second)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(result.String()), nil
}

func materializeAtFixtureTime(t *testing.T, spec json.RawMessage, datasets map[string]json.RawMessage) (*Artifacts, error) {
	t.Helper()
	input, err := json.Marshal(struct {
		ReportSpec json.RawMessage            `json:"reportSpec"`
		Datasets   map[string]json.RawMessage `json:"datasets"`
	}{ReportSpec: spec, Datasets: datasets})
	if err != nil {
		return nil, err
	}
	programOnce.Do(func() { program, programError = goja.Compile("forge-authored-lowerer", bundle, true) })
	if programError != nil {
		return nil, programError
	}
	result, err := runEntryWithTimeSourceTimeout(context.Background(), program, "materialize", input, func() time.Time { return materializerFixtureTime }, 30*time.Second)
	if err != nil {
		return nil, err
	}
	var artifacts Artifacts
	if json.Unmarshal([]byte(result.String()), &artifacts) != nil || len(artifacts.ReportFill) == 0 || len(artifacts.ReportPrint) == 0 {
		return nil, fmt.Errorf("fixture-time materialization invalid")
	}
	return &artifacts, nil
}

func rawJSONSHA256(raw []byte) string {
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}

func canonicalJSONSHA256(raw []byte) string {
	var value any
	if json.Unmarshal(raw, &value) != nil {
		return ""
	}
	canonical, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	digest := sha256.Sum256(canonical)
	return hex.EncodeToString(digest[:])
}
