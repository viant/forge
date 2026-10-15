// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"

	"testing"
	"time"

	"github.com/stretchr/testify/require"

	identity "github.com/viant/forge/backend/resource"

	forgeTypes "github.com/viant/forge/backend/types"
)

type localFixturePolicy struct {
	actor         identity.VerifiedActor
	now           func() time.Time
	denyAfterRead *bool
	denyOmitted   bool
	seenRevision  *string
}

func (p localFixturePolicy) SelectRevision(_ context.Context, ref identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	if p.seenRevision != nil {
		*p.seenRevision = ref.Revision
	}
	if ref.Revision != "" && ref.Revision != identity.WorkingCandidate || ref.Revision == "" && p.denyOmitted || len(candidates) != 1 || candidates[0].Kind != identity.WorkingCandidate {
		return identity.ResourceDecision{}, identity.ErrResourceDenied
	}
	if p.denyAfterRead != nil && *p.denyAfterRead {
		return identity.ResourceDecision{}, identity.ErrResourceDenied
	}
	return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "fixture-authority", ValidUntil: p.actor.ValidUntil}, nil
}
func localWindowBytes(t *testing.T) json.RawMessage {
	t.Helper()
	w := &forgeTypes.Window{View: forgeTypes.View{Content: &forgeTypes.Container{ID: "root"}}}
	v := forgeTypes.WindowResourceVariant{Window: w, DataSources: map[string]json.RawMessage{}}
	fp, err := forgeTypes.WindowVariantFingerprint(v)
	require.NoError(t, err)
	e := forgeTypes.WindowResourceEnvelope{SchemaVersion: 2, Format: forgeTypes.WindowBundleFormat, Targets: []forgeTypes.WindowTargetBinding{{Target: forgeTypes.WindowTarget{}, Variant: fp}}, Variants: map[string]forgeTypes.WindowResourceVariant{fp: v}}
	raw, err := json.Marshal(e)
	require.NoError(t, err)
	require.NoError(t, e.Validate())
	return raw
}
