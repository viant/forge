package reporting

import (
	"context"
	"sync"
)

// Keep serial execution as the default for existing host executors. Parallel
// execution is host-selected, bounded, and canceled as one report operation.
func runReportDatasetPlans(ctx context.Context, count, concurrency int, fetch func(context.Context, int) error) error {
	if concurrency <= 1 {
		for index := 0; index < count; index++ {
			if err := ctx.Err(); err != nil {
				return err
			}
			if err := fetch(ctx, index); err != nil {
				return err
			}
		}
		return ctx.Err()
	}
	if concurrency > 8 {
		concurrency = 8
	}
	if concurrency > count {
		concurrency = count
	}
	workCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	jobs := make(chan int)
	var workers sync.WaitGroup
	var failed sync.Once
	var firstError error
	for worker := 0; worker < concurrency; worker++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for index := range jobs {
				if workCtx.Err() != nil {
					return
				}
				if err := fetch(workCtx, index); err != nil {
					failed.Do(func() { firstError = err; cancel() })
					return
				}
			}
		}()
	}
enqueue:
	for index := 0; index < count; index++ {
		select {
		case <-workCtx.Done():
			break enqueue
		case jobs <- index:
		}
	}
	close(jobs)
	workers.Wait()
	if firstError != nil {
		return firstError
	}
	return ctx.Err()
}
