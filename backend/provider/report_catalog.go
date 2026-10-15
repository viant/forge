// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"github.com/viant/forge/backend/reporting/catalog"

	identity "github.com/viant/forge/backend/resource"
)

const ReportCatalogTool = "forgeReportCatalog"
const ReportDefinitionTool = "forgeReportDefinition"

type ReportDefinitionInput struct {
	Resource         identity.ResourceRef       `json:"resource"`
	ResolvedResource *identity.ResolvedResource `json:"resolvedResource,omitempty"`
}
type ReportDefinitionOutput struct {
	Definition json.RawMessage            `json:"definition"`
	Resource   *identity.ResolvedResource `json:"resource"`
}

func (s *Service) HasReportCatalog() bool {
	return s != nil && s.cfg != nil && s.cfg.ReportCatalog != nil
}
func (s *Service) ReportCatalog(ctx context.Context, input *catalog.ReportCatalogQuery) (*catalog.ReportCatalogResult, error) {
	if !s.HasReportCatalog() || input == nil {
		return nil, identity.ErrResourceDenied
	}
	readCtx, finish, err := BeginMetadataReadScope(ctx, s.cfg.MetadataScope)
	if err != nil {
		return nil, err
	}
	result, err := s.cfg.ReportCatalog.List(readCtx, *input)
	if err := FinishMetadataReadScope(finish, err); err != nil {
		return nil, err
	}
	return result, nil
}
func (s *Service) ReportDefinition(ctx context.Context, input *ReportDefinitionInput) (*ReportDefinitionOutput, error) {
	if !s.HasReportCatalog() || input == nil {
		return nil, identity.ErrResourceDenied
	}
	readCtx, finish, err := BeginMetadataReadScope(ctx, s.cfg.MetadataScope)
	if err != nil {
		return nil, err
	}
	raw, pin, err := s.cfg.ReportCatalog.Read(readCtx, input.Resource, input.ResolvedResource)
	if err := FinishMetadataReadScope(finish, err); err != nil {
		return nil, err
	}
	return &ReportDefinitionOutput{Definition: raw, Resource: pin}, nil
}
