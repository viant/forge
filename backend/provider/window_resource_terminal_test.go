// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"testing"
	"time"
)

type narrowWindowReadCatalog struct {
	pin              identity.ResolvedResource
	terminalDeadline time.Time
}

func (*narrowWindowReadCatalog) AuthzReady() bool             { return true }
func (*narrowWindowReadCatalog) UsesResourceResolution() bool { return true }
func (*narrowWindowReadCatalog) List(context.Context, *WindowDefinitionListInput) (*WindowDefinitionListOutput, error) {
	return nil, nil
}
func (*narrowWindowReadCatalog) Get(context.Context, *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	return nil, nil
}
func (c *narrowWindowReadCatalog) RevalidateWindowResource(context.Context, string, identity.ResolvedResource, *types.WindowTarget) (*identity.ResolvedResource, error) {
	copy := c.pin
	copy.ValidUntil = time.Now().Add(15 * time.Millisecond)
	return &copy, nil
}
func (c *narrowWindowReadCatalog) CheckWindowContent(ctx context.Context, _ string, _ identity.ResolvedResource, _ *types.WindowTarget) error {
	c.terminalDeadline, _ = ctx.Deadline()
	time.Sleep(30 * time.Millisecond)
	return nil
}
func TestWindowResourceTerminalCheckCannotOutliveNarrowerReturnedLease(t *testing.T) {
	pin := identity.ResolvedResource{ProviderIdentity: "owned", URI: "window://example/root", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: "owned-fingerprint"}, AuthorityBinding: "owned-authority", ValidUntil: time.Now().Add(time.Minute)}
	catalog := &narrowWindowReadCatalog{pin: pin}
	svc := NewService(&Config{WindowDefinitions: catalog})
	svc.resourcePins[windowPinKey{Namespace: "owned", ClientID: "client", WindowID: "window"}] = windowResourcePin{WindowKey: "window://example/root", Resource: pin}
	current, err := svc.WindowResource(context.Background(), "owned", "client", "window", "window://example/root")
	if err == nil || current != nil {
		t.Fatal("terminal callback consumed returned lease but released pin")
	}
	if catalog.terminalDeadline.IsZero() || !catalog.terminalDeadline.Before(pin.ValidUntil) {
		t.Fatal("terminal context was not bounded by narrower verified lease")
	}
}
