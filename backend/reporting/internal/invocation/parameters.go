package invocation

import "context"

// Parameters carries admitted, invocation-local builder state across the native
// lowering boundary. It is neither an authored setting nor producer arguments.
type Parameters struct {
	Values     map[string]interface{}            `json:"values,omitempty"`
	DateRanges map[string]map[string]interface{} `json:"dateRanges,omitempty"`
}

type parametersKey struct{}

func WithParameters(ctx context.Context, parameters Parameters) context.Context {
	return context.WithValue(ctx, parametersKey{}, parameters)
}

func FromContext(ctx context.Context) (Parameters, bool) {
	parameters, ok := ctx.Value(parametersKey{}).(Parameters)
	return parameters, ok && (len(parameters.Values) > 0 || len(parameters.DateRanges) > 0)
}
