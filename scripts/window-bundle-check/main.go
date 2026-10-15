// Validate the exact emitted editor YAML against the canonical backend.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/types"
	"github.com/viant/forge/scripts/internal/windowyaml"
	"os"
)

func main() {
	for _, path := range os.Args[1:] {
		data, err := os.ReadFile(path)
		if err != nil {
			panic(err)
		}
		raw, err := windowyaml.JSON(data)
		if err != nil {
			panic(err)
		}
		var envelope types.WindowResourceEnvelope
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.UseNumber()
		if err := decoder.Decode(&envelope); err != nil {
			panic(err)
		}
		if err := envelope.Validate(); err != nil {
			panic(fmt.Errorf("%s: %w", path, err))
		}
		fmt.Printf("Validated %s: %d targets, %d canonical variants\n", path, len(envelope.Targets), len(envelope.Variants))
	}
}
