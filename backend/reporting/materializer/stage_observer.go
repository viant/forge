package materializer

import (
	"context"
	"encoding/json"

	"github.com/dop251/goja"
	"github.com/viant/forge/backend/provider/contract/observe"
)

// The trusted entry receives this callback only for an observed invocation.
// Passing it as an argument, rather than VM state, keeps pooled observers local.
func invokeMaterializerEntry(ctx context.Context, runtime *goja.Runtime, entry string, invoke goja.Callable, raw json.RawMessage) (result goja.Value, err error) {
	if entry != "materialize" && entry != "materializeFill" || !observe.Enabled(ctx) {
		return invoke(goja.Undefined(), runtime.ToValue(string(raw)))
	}
	stages := materializerStages{ctx: ctx}
	returned := false
	defer func() {
		outcome := observe.Error // Panics also close an active phase before unwinding.
		if returned {
			outcome = observe.OutcomeFor(err)
		}
		stages.end(outcome)
	}()
	result, err = invoke(goja.Undefined(), runtime.ToValue(string(raw)), runtime.ToValue(stages.mark))
	returned = true
	return result, err
}

type materializerStages struct {
	ctx    context.Context
	span   observe.Span
	active bool
}

func (stages *materializerStages) mark(name string) {
	var phase observe.Phase
	switch name {
	case "parse":
		phase = "report.materializer.input.parse"
	case "fill":
		phase = "report.materializer.fill"
	case "print":
		phase = "report.materializer.print"
	case "serialize":
		phase = "report.materializer.output.serialize"
	case "done":
		stages.end(observe.OK)
		return
	default:
		return // Never turn an arbitrary string into a label or phase.
	}
	stages.end(observe.OK)
	stages.span = observe.Start(stages.ctx, phase, observe.Labels{Kind: "report"})
	stages.active = true
}

func (stages *materializerStages) end(outcome observe.Outcome) {
	if !stages.active {
		return
	}
	stages.active = false
	stages.span.End(outcome, observe.CacheUnknown)
}
