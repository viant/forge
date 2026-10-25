//go:build ignore

// Hash official Node artifacts using the retained Go JSON canonicalization rules.
// This tool does not import or execute the materializer implementation.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
)

func digest(raw []byte) string { h := sha256.Sum256(raw); return hex.EncodeToString(h[:]) }
func canonical(raw json.RawMessage) (string, error) {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", err
	}
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return digest(data), nil
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run() error {
	var artifacts map[string]map[string]json.RawMessage
	if err := json.NewDecoder(os.Stdin).Decode(&artifacts); err != nil {
		return err
	}
	result := map[string]map[string]string{}
	for name, artifact := range artifacts {
		hashes := map[string]string{}
		for _, kind := range []string{"reportSpec", "reportFill"} {
			hash, err := canonical(artifact[kind])
			if err != nil {
				return fmt.Errorf("%s %s: %w", name, kind, err)
			}
			hashes[kind] = hash
		}
		if !json.Valid(artifact["reportPrint"]) {
			return fmt.Errorf("%s invalid print JSON", name)
		}
		hashes["reportPrint"] = digest(artifact["reportPrint"])
		result[name] = hashes
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(result)
}
