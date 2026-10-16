// Compile a confined Forge source manifest from stdin without application services.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	window "github.com/viant/forge/backend/window/source"
	"io"
	"os"
)

func main() {
	var manifest window.WindowSourceManifest
	decoder := json.NewDecoder(io.LimitReader(os.Stdin, 16<<20))
	if err := decoder.Decode(&manifest); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	definition, err := window.CompileWindowSource(context.Background(), manifest)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err = json.NewEncoder(os.Stdout).Encode(map[string]any{"definition": definition}); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
