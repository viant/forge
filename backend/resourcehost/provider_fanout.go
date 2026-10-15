// SPDX-License-Identifier: Apache-2.0
// Shared primitive delivery; kept aligned with the Core compatibility boundary.
package resource

import (
	"context"
	"github.com/viant/forge/backend/provider/contract/observe"
	"sync"
	"sync/atomic"
)

type providerResult[T any] struct {
	value T
	err   error
}

// providerFanout bounds independent provider work and retains input order for
// deterministic error and collision handling. Routing and listing share it.
func providerFanout[T any](ctx context.Context, names []string, load func(context.Context, string) (T, error)) []providerResult[T] {
	results := make([]providerResult[T], len(names))
	var queued []observe.Span
	if observe.Enabled(ctx) {
		queued = make([]observe.Span, len(names))
		for i, name := range names {
			queued[i] = observe.Start(ctx, "gateway.provider.queue", observe.Labels{Provider: name})
		}
	}
	var next atomic.Int64
	var workers sync.WaitGroup
	for worker := 0; worker < min(4, len(names)); worker++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for {
				i := int(next.Add(1) - 1)
				if i >= len(names) {
					return
				}
				if len(queued) != 0 {
					queued[i].End(observe.OutcomeFor(ctx.Err()), observe.CacheUnknown)
				}
				if err := ctx.Err(); err != nil {
					results[i].err = err
					continue
				}
				span := observe.Start(ctx, "gateway.provider.work", observe.Labels{Provider: names[i]})
				results[i].value, results[i].err = load(ctx, names[i])
				span.End(observe.OutcomeFor(results[i].err), observe.CacheUnknown)
			}
		}()
	}
	workers.Wait()
	return results
}
