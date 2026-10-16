package diagnostic

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
)

func TestWarningsAreScopedAndConcurrent(t *testing.T) {
	emitter := warningEmitter{capacity: 16}
	var count atomic.Int32
	var workers sync.WaitGroup
	for i := 0; i < 100; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			if emitter.admit("/one/", "orders", "datasource", "records") {
				count.Add(1)
			}
		}()
	}
	workers.Wait()
	if count.Load() != 1 {
		t.Fatalf("concurrent issue emitted %d times", count.Load())
	}
	if emitter.admit("/one", "orders", "datasource", "records") {
		t.Fatal("trailing slash must not change scope")
	}
	for _, key := range [][4]string{{"/two", "orders", "datasource", "records"}, {"/one", "inventory", "datasource", "records"}, {"/one", "orders", "dialog", "records"}, {"/one", "orders", "datasource", "other"}} {
		if !emitter.admit(key[0], key[1], key[2], key[3]) {
			t.Fatalf("independent diagnostic suppressed: %v", key)
		}
	}
}

func TestWarningsRetainBoundedHistory(t *testing.T) {
	emitter := warningEmitter{capacity: 4}
	for i := 0; i < 100; i++ {
		emitter.admit("root", "window", "datasource", fmt.Sprint(i))
	}
	if len(emitter.seen) != 4 || len(emitter.order) != 4 {
		t.Fatalf("unbounded history: %d keys, %d order", len(emitter.seen), len(emitter.order))
	}
	if !emitter.admit("root", "window", "datasource", "0") {
		t.Fatal("oldest diagnostic should be evicted")
	}
	if emitter.admit("root", "window", "datasource", "99") {
		t.Fatal("recent diagnostic should remain suppressed")
	}
}
