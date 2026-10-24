package materializer

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/dop251/goja"
	"github.com/viant/forge/backend/provider/contract/observe"
)

// Only the compiled, code-owned lowerer can reuse an initialized runtime.
// A bounded pool limits retained JS heap; callers never share a runtime at
// once, and interrupted/failed runtimes are discarded. Fixture programs and
// custom time sources continue through the fresh-runtime path.
var trustedRuntimePool = make(chan *goja.Runtime, 2)

// PrepareTrustedRuntime pays the code-owned bundle compile/bootstrap cost before
// serving interactive previews. It executes no authored report or datasource.
// Only a successfully initialized empty runtime enters the bounded pool.
func PrepareTrustedRuntime(ctx context.Context) error {
	if ctx == nil {
		return fmt.Errorf("materializer context required")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	programOnce.Do(func() { program, programError = goja.Compile("forge-authored-lowerer", bundle, true) })
	if programError != nil {
		return fmt.Errorf("trusted lowerer bundle invalid: %w", programError)
	}
	if len(trustedRuntimePool) == cap(trustedRuntimePool) {
		return nil
	}
	bounded, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	runtime := goja.New()
	stop := make(chan struct{})
	watcherDone := make(chan struct{})
	go func() {
		defer close(watcherDone)
		select {
		case <-bounded.Done():
			runtime.Interrupt(bounded.Err())
		case <-stop:
		}
	}()
	_, err := runtime.RunProgram(program)
	close(stop)
	<-watcherDone
	if err != nil {
		return loweringError(bounded, err)
	}
	if err = bounded.Err(); err != nil {
		return err
	}
	runtime.ClearInterrupt()
	select {
	case trustedRuntimePool <- runtime:
	default:
	}
	return nil
}

func runTrustedEntry(ctx context.Context, compiled *goja.Program, entry string, raw json.RawMessage) (output string, err error) {
	if compiled == nil || compiled != program || entry != "lower" && entry != "lowerWithRequestBase" && entry != "materialize" && entry != "materializeFill" && entry != "present" {
		return "", fmt.Errorf("untrusted materializer entry")
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	var runtime *goja.Runtime
	cache := observe.CacheMiss
	select {
	case runtime = <-trustedRuntimePool:
		cache = observe.CacheHit
	default:
		runtime = goja.New()
	}
	bounded, cancel := context.WithTimeout(ctx, 15*time.Second)
	healthy := false
	stop := make(chan struct{})
	watcherDone := make(chan struct{})
	go func() {
		defer close(watcherDone)
		select {
		case <-bounded.Done():
			runtime.Interrupt(bounded.Err())
		case <-stop:
		}
	}()
	defer func() {
		close(stop)
		<-watcherDone // no late interrupt may affect the next borrower
		if healthy && err == nil && bounded.Err() == nil {
			runtime.ClearInterrupt()
			select {
			case trustedRuntimePool <- runtime:
			default:
			}
		}
		cancel()
	}()
	bootstrap := observe.Start(ctx, "report.materializer.runtime.bootstrap", observe.Labels{Kind: "report"})
	if cache == observe.CacheMiss {
		_, err = runtime.RunProgram(compiled)
	}
	bootstrap.End(observe.OutcomeFor(err), cache)
	if err != nil {
		return "", loweringError(bounded, err)
	}
	api := runtime.Get("ForgeAuthoredLowerer").ToObject(runtime)
	invoke, ok := goja.AssertFunction(api.Get(entry))
	if !ok {
		return "", fmt.Errorf("trusted lowerer entry missing")
	}
	invocation := observe.Start(ctx, "report.materializer.runtime.invoke", observe.Labels{Kind: "report"})
	var result goja.Value
	result, err = invoke(goja.Undefined(), runtime.ToValue(string(raw)))
	invocation.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return "", loweringError(bounded, err)
	}
	if err = bounded.Err(); err != nil {
		return "", err
	}
	value, ok := result.Export().(string)
	if !ok {
		return "", fmt.Errorf("trusted lowerer returned non-string output")
	}
	// Force an independent Go allocation before the VM is available to another
	// verified caller. Never return a goja.Value tied to a pooled runtime.
	output = strings.Clone(value)
	if err = bounded.Err(); err != nil {
		return "", err
	}
	healthy = true // a panic or partial conversion must discard the leased VM
	return output, nil
}
