// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package catalog

import (
	"context"
	identity "github.com/viant/forge/backend/resource"
)

type AuthoredReportInventory struct {
	Source *ReportResourceSource
}

func (s AuthoredReportInventory) ListReportResources(ctx context.Context, actor identity.VerifiedActor) ([]ReportCatalogCandidate, error) {
	if s.Source == nil {
		return nil, identity.ErrResourceDenied
	}
	entries, err := s.Source.List(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]ReportCatalogCandidate, 0, len(entries))
	for _, entry := range entries {
		result = append(result, ReportCatalogCandidate{URI: entry.URI, Title: entry.Title, Description: entry.Description, OwnerID: entry.OwnerID, BuilderRef: entry.BuilderRef, BuilderWindow: entry.BuilderWindow, ReportID: entry.URI})
	}
	return result, nil
}
