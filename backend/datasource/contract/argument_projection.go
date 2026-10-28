package datasource

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var argumentName = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// ValidateArgumentProjection validates only the opt-in single-tool projection.
// It cannot select a service, method or component; those remain admitted metadata.
func (b *Backend) ValidateArgumentProjection() error {
	if b == nil || len(b.Args) == 0 {
		return nil
	}
	if b.Kind != BackendMCPTool || strings.TrimSpace(b.Service) == "" || strings.TrimSpace(b.Method) == "" {
		return fmt.Errorf("argument projection requires a fixed MCP tool backend")
	}
	targets := make([]string, 0, len(b.Args))
	for target, selector := range b.Args {
		if !validArgumentProjectionPath(target) || !strings.HasPrefix(selector, "inputs.") || !validArgumentProjectionPath(strings.TrimPrefix(selector, "inputs.")) {
			return fmt.Errorf("invalid MCP argument projection path")
		}
		for _, prior := range targets {
			if projectionPathsOverlap(target, prior) {
				return fmt.Errorf("overlapping MCP argument projection targets")
			}
		}
		for pinned := range b.Pinned {
			if target != pinned && projectionPathsOverlap(target, pinned) {
				return fmt.Errorf("MCP argument projection overlaps pinned argument")
			}
		}
		targets = append(targets, target)
	}
	containers := map[string]bool{}
	for pinned := range b.Pinned {
		if !validArgumentProjectionPath(pinned) {
			return fmt.Errorf("invalid pinned MCP argument projection path")
		}
		targets = append(targets, pinned)
	}
	for _, target := range targets {
		parts := strings.Split(target, ".")
		for i := 1; i < len(parts); i++ {
			parent := strings.Join(parts[:i], ".")
			_, err := strconv.Atoi(parts[i])
			array := err == nil
			if prior, found := containers[parent]; found && prior != array {
				return fmt.Errorf("incompatible MCP argument projection container shapes")
			}
			containers[parent] = array
		}
	}
	return nil
}
func projectionPathsOverlap(a, b string) bool {
	return a == b || strings.HasPrefix(a, b+".") || strings.HasPrefix(b, a+".")
}
func validArgumentProjectionPath(path string) bool {
	for i, part := range strings.Split(path, ".") {
		if part == "__proto__" || part == "prototype" || part == "constructor" {
			return false
		}
		if argumentName.MatchString(part) {
			continue
		}
		// Bound indexed paths to avoid unbounded sparse array allocation.
		if i == 0 || len(part) > 4 {
			return false
		}
		index, err := strconv.Atoi(part)
		if err != nil || index < 0 || index > 4095 || strconv.Itoa(index) != part {
			return false
		}
	}
	return true
}
