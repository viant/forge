package artifactcohort

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/types"
)

// OpenWindowVariant selects one variant from a producer-validated, closed
// schema 2 artifact. It does not walk dependencies or ask the producer to
// revalidate the graph. The returned variant is request-owned and includes its
// inline datasource descriptors for the existing authorized execution path.
func (r *Replica) OpenWindowVariant(ctx context.Context, uri string, requested *types.WindowTarget) (selected *types.WindowResourceVariant, selectedHash string, openErr error) {
	source := ""
	if r != nil {
		source = r.cfg.Source
	}
	windowTiming := timing(ctx, phaseWindowOpen, source, "window")
	defer func() { windowTiming.End(timingOutcome(openErr), observe.CacheUnknown) }()
	view, err := r.Open(ctx, uri)
	if err != nil {
		return nil, "", err
	}
	if view.Ref().Kind != "window" {
		return nil, "", ErrDenied
	}
	var envelope types.WindowResourceEnvelope
	payload := view.Payload()
	decodeTiming := timing(ctx, phaseWindowDecode, source, "window")
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.UseNumber()
	err = decoder.Decode(&envelope)
	decodeTiming.EndBytes(timingOutcome(err), observe.CacheUnknown, int64(len(payload)))
	if err != nil {
		return nil, "", ErrInvalid
	}
	if envelope.SchemaVersion != 2 || envelope.Format != types.WindowBundleFormat {
		return nil, "", ErrInvalid
	}
	target := types.WindowTarget{}
	if requested != nil {
		target = *requested
	}
	target, err = target.Normalize()
	if err != nil {
		return nil, "", ErrInvalid
	}
	for _, binding := range envelope.Targets {
		if binding.Target.ProfileKey() != target.ProfileKey() {
			continue
		}
		variant, ok := envelope.Variants[binding.Variant]
		if !ok || variant.Window == nil {
			return nil, "", ErrInvalid
		}
		variant.Window.ResourceTarget = &target
		return &variant, view.ETag(), nil
	}
	return nil, "", ErrUnavailable
}

func (r *Replica) OpenWindow(ctx context.Context, uri string, requested *types.WindowTarget) (*types.Window, string, error) {
	variant, hash, err := r.OpenWindowVariant(ctx, uri, requested)
	if err != nil {
		return nil, "", err
	}
	return variant.Window, hash, nil
}
