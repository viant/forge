package artifactcohort

import (
	"context"
	"errors"

	"github.com/viant/forge/backend/provider/contract/observe"
)

const (
	phaseSyncTotal         observe.Phase = "artifact.sync.total"
	phaseManifestLoad      observe.Phase = "artifact.manifest.load"
	phaseDiscovery         observe.Phase = "artifact.discovery"
	phasePolicyCompile     observe.Phase = "artifact.policy.compile"
	phaseStoreHas          observe.Phase = "artifact.store.has"
	phaseArtifactFetch     observe.Phase = "artifact.fetch"
	phaseStorePut          observe.Phase = "artifact.store.put"
	phaseStoreGet          observe.Phase = "artifact.store.get"
	phasePartitionStage    observe.Phase = "artifact.partition.stage"
	phasePartitionActivate observe.Phase = "artifact.partition.activate"
	phaseManifestSave      observe.Phase = "artifact.manifest.save"
	phaseAdmit             observe.Phase = "artifact.admit"
	phaseRootOpen          observe.Phase = "artifact.root.open"
	phaseWindowOpen        observe.Phase = "artifact.window.open"
	phaseWindowDecode      observe.Phase = "artifact.window.decode"
)

func timing(ctx context.Context, phase observe.Phase, source, kind string) observe.Span {
	return observe.Start(ctx, phase, observe.Labels{Provider: source, Kind: kind})
}
func timingOutcome(err error) observe.Outcome {
	if errors.Is(err, ErrDenied) {
		return observe.Denied
	}
	return observe.OutcomeFor(err)
}
