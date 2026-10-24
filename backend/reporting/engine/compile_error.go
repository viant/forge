package reporting

import (
	"context"
	"errors"
	"fmt"

	identity "github.com/viant/forge/backend/resource"
)

// CompileStageError identifies a pure report authoring stage. Reader, transport,
// dependency admission and dataset execution failures are not compilation errors.
// Cause remains internal diagnostic evidence, not a public response message.
type CompileStageError struct {
	Stage string
	Cause error
}

func (e *CompileStageError) Error() string {
	return fmt.Sprintf("report compilation %s: %v", e.Stage, e.Cause)
}
func (e *CompileStageError) Unwrap() error { return e.Cause }

const (
	CompileStageEnvelope = "envelope"
	CompileStageLower    = "lower"
	CompileStageBind     = "bind"
	CompileStageCompiler = "compiler"
)

func compileStageError(stage string, err error) error {
	if err == nil || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || errors.Is(err, identity.ErrResourceDenied) {
		return err
	}
	return &CompileStageError{Stage: stage, Cause: err}
}
