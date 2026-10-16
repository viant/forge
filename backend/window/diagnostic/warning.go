// SPDX-License-Identifier: Apache-2.0
// Package diagnostic emits bounded, process-local window diagnostics shared by
// source loaders and legacy hosts. It does not decide validation severity.
package diagnostic

import (
	"crypto/sha256"
	"fmt"
	"log"
	"strings"
	"sync"
)

const warningCapacity = 4096

var warnings = warningEmitter{capacity: warningCapacity}

type warningEmitter struct {
	mu       sync.Mutex
	capacity int
	seen     map[[32]byte]struct{}
	order    [][32]byte
	next     int
}

// WarnOnce logs an issue once for a workspace/window/kind/reference combination.
// Messages and counts are deliberately excluded from identity. Old entries may
// be emitted again after eviction, keeping memory bounded across long-lived hosts.
func WarnOnce(root, window, kind, ref, format string, args ...interface{}) {
	if warnings.admit(root, window, kind, ref) {
		log.Printf(format, args...)
	}
}

func (e *warningEmitter) admit(root, window, kind, ref string) bool {
	root = strings.TrimSpace(root)
	if root != "/" {
		root = strings.TrimRight(root, "/")
	}
	hash := sha256.New()
	for _, part := range []string{root, window, kind, ref} {
		fmt.Fprintf(hash, "%d:%s", len(part), part)
	}
	var key [32]byte
	copy(key[:], hash.Sum(nil))
	e.mu.Lock()
	defer e.mu.Unlock()
	if _, exists := e.seen[key]; exists {
		return false
	}
	if e.seen == nil {
		e.seen = make(map[[32]byte]struct{})
	}
	if len(e.order) < e.capacity {
		e.order = append(e.order, key)
	} else {
		delete(e.seen, e.order[e.next])
		e.order[e.next] = key
		e.next = (e.next + 1) % e.capacity
	}
	e.seen[key] = struct{}{}
	return true
}
