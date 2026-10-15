// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
	forgeTypes "github.com/viant/forge/backend/types"
	workspacewindow "github.com/viant/forge/backend/window/source"
	"io"
	"strings"
)

// WorkspaceWindowBindings adapts the canonical local workspace loader into
// explicit working-only provider bindings. Host policy remains injected per
// verified actor and operation; this helper grants no access by itself.
func WorkspaceWindowBindings(root, providerIdentity string, bindings []workspacewindow.ResourceBinding, policy LocalRevisionPolicyFactory, enrich workspacewindow.WorkspaceWindowEnricher) ([]LocalResourceBinding, error) {
	if strings.TrimSpace(providerIdentity) == "" || policy == nil || len(bindings) == 0 {
		return nil, fmt.Errorf("workspace window bindings require provider identity and revision policy")
	}
	source, err := workspacewindow.NewWorkspaceResourceSource(root, bindings, enrich)
	if err != nil {
		return nil, err
	}
	out := make([]LocalResourceBinding, 0, len(bindings))
	for _, configured := range bindings {
		uri, err := identity.ParseResourceURI(configured.URI)
		if err != nil || uri.Kind != "window" {
			return nil, fmt.Errorf("workspace resource binding must name a window")
		}
		binding := configured
		out = append(out, LocalResourceBinding{URI: binding.URI, Title: binding.WindowKey, FormatVersion: 2, Resolver: func(ctx context.Context, actor identity.VerifiedActor, action string) (*identity.ResourceResolver, error) {
			currentURI, err := identity.ParseResourceURI(binding.URI)
			if err != nil {
				return nil, identity.ErrResourceDenied
			}
			revisionPolicy, err := policy(ctx, actor, currentURI, action)
			if err != nil {
				return nil, err
			}
			if revisionPolicy == nil {
				return nil, identity.ErrResourceDenied
			}
			return &identity.ResourceResolver{ProviderIdentity: providerIdentity, Source: source, Policy: revisionPolicy}, nil
		}})
	}
	return out, nil
}

// ValidateWindowBundle validates the versioned local Forge window bundle.
func ValidateWindowBundle(formatVersion int64, raw json.RawMessage) error {
	if formatVersion != 2 && formatVersion != 3 {
		return fmt.Errorf("unsupported window format")
	}
	var bundle forgeTypes.WindowResourceEnvelope
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	d.UseNumber()
	if err := d.Decode(&bundle); err != nil {
		return err
	}
	if d.Decode(new(any)) != io.EOF {
		return fmt.Errorf("trailing window data")
	}
	if int64(bundle.SchemaVersion) != formatVersion {
		return fmt.Errorf("window format/schema version mismatch")
	}
	return bundle.Validate()
}

// ValidateReportEnvelope validates the supported local report definition form.
func ValidateReportEnvelope(formatVersion int64, raw json.RawMessage) error {
	if formatVersion != 1 {
		return fmt.Errorf("unsupported report format")
	}
	var envelope registry.ReportEnvelope
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(&envelope); err != nil {
		return err
	}
	if d.Decode(new(any)) != io.EOF || envelope.SchemaVersion != 1 ||
		len(envelope.ReportDocument) == 0 && len(envelope.ReportSpec) == 0 ||
		len(envelope.ReportDocument) > 0 && !validJSONObject(envelope.ReportDocument) ||
		len(envelope.ReportSpec) > 0 && !validJSONObject(envelope.ReportSpec) {
		return fmt.Errorf("invalid report envelope")
	}
	switch envelope.Format {
	case "":
		if len(envelope.ReportSpec) > 0 && !validJSONObject(envelope.ReportSpec) || len(envelope.BuilderDefinition) != 0 {
			return fmt.Errorf("invalid native report envelope")
		}
	case registry.AuthoredReportFormat:
		if !validJSONObject(envelope.ReportDocument) || envelope.BuilderRef == "" || !validJSONObject(envelope.BuilderDefinition) {
			return fmt.Errorf("invalid authored report envelope")
		}
	default:
		return fmt.Errorf("unsupported report envelope")
	}
	return nil
}

func validJSONObject(raw json.RawMessage) bool {
	var value map[string]json.RawMessage
	return len(raw) > 0 && json.Unmarshal(raw, &value) == nil && value != nil
}
