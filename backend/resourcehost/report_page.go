package resource

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

// ReportPagePreparation can batch a local source's storage reads for the selected
// page. Get still owns provider and account admission. Finish rechecks the rows.
type ReportPagePreparation func(context.Context, []LocatedResource) (context.Context, func() error, error)

// Store only the report fields used by discovery. The resolved pin is issued
// against the full authorized bytes and exact opening still uses Get.
func (row *LocatedResource) projectReportSummary() error {
	var summary struct {
		BuilderRef string `json:"builderRef"`
	}
	if err := json.Unmarshal(row.Resource.Definition, &summary); err != nil {
		return err
	}
	row.ReportBuilderRef = summary.BuilderRef
	row.Resource.Definition = nil
	row.Resource.DefinitionBytes = nil
	return nil
}

// hydrateReportPage resolves personal definitions only after the authorized
// metadata index has applied its search and cursor. Cache the selected batch
// using the same source generations, principal partition and shortest pin lease.
func (g *Gateway) hydrateReportPage(ctx context.Context, entries []json.RawMessage, prepare ReportPagePreparation) ([]json.RawMessage, error) {
	var pending []LocatedResource
	for _, value := range entries {
		var row LocatedResource
		if err := json.Unmarshal(value, &row); err != nil {
			return nil, err
		}
		if row.ResolvedResource == nil {
			pending = append(pending, row)
		}
	}
	if len(pending) == 0 {
		return entries, nil
	}
	keyBytes, err := json.Marshal(pending)
	if err != nil {
		return nil, err
	}
	key := fmt.Sprintf("report:page:%x", sha256.Sum256(keyBytes))
	var lease time.Time
	index, _, err := g.catalog(ctx, key, "report", func(ctx context.Context) (items []primitive.CatalogItem[json.RawMessage], failure error) {
		var finish func() error
		if prepare != nil {
			var err error
			ctx, finish, err = prepare(ctx, pending)
			if err != nil {
				return nil, err
			}
		}
		if finish != nil {
			defer func() {
				if err := finish(); err != nil {
					items = nil
					failure = errors.Join(failure, err)
				}
			}()
		}
		page := make(map[string]json.RawMessage, len(pending))
		for _, row := range pending {
			fresh, err := readResource[json.RawMessage](ctx, g, row.Connection, identity.ResourceRef{URI: row.Resource.URI, Revision: row.Resource.Revision}, nil, false, false)
			if errors.Is(err, identity.ErrResourceDenied) && !resourceIdentityRejected(err) {
				continue
			}
			if errors.Is(err, identity.ErrStoredDefinition) {
				row.Unavailable = true
			} else {
				if err != nil {
					poisonReadSequence(ctx, err)
					return nil, err
				}
				if fresh.ResolvedResource == nil {
					return nil, identity.ErrResourceDenied
				}
				if row.Resource.RowEtag != 0 && fresh.Resource.RowEtag != 0 && row.Resource.RowEtag != fresh.Resource.RowEtag {
					return nil, identity.ErrResourceStale
				}
				if lease.IsZero() || fresh.ResolvedResource.ValidUntil.Before(lease) {
					lease = fresh.ResolvedResource.ValidUntil
				}
				row.ResolvedResource = fresh.ResolvedResource
				row.Resource = *fresh.Resource
				row.Resource.Definition = fresh.Definition
				if err := row.projectReportSummary(); err != nil {
					return nil, err
				}
			}
			value, err := json.Marshal(row)
			if err != nil {
				return nil, err
			}
			page[row.Connection.ProviderIdentity+"\x00"+row.Resource.URI] = value
		}
		raw, err := json.Marshal(page)
		if err != nil {
			return nil, err
		}
		return []primitive.CatalogItem[json.RawMessage]{{Name: key, Value: raw}}, nil
	}, func() time.Time { return lease })
	if err != nil {
		return nil, err
	}
	item, err := index.Page(ctx, CatalogQuery{Limit: 1})
	if err != nil {
		return nil, err
	}
	if len(item.Items) != 1 {
		return nil, identity.ErrResource
	}
	var page map[string]json.RawMessage
	if err = json.Unmarshal(item.Items[0], &page); err != nil {
		return nil, err
	}
	result := make([]json.RawMessage, 0, len(entries))
	for _, value := range entries {
		var row LocatedResource
		if err = json.Unmarshal(value, &row); err != nil {
			return nil, err
		}
		if row.ResolvedResource == nil {
			value = page[row.Connection.ProviderIdentity+"\x00"+row.Resource.URI]
			if value == nil {
				continue
			}
		}
		result = append(result, value)
	}
	if g.Manager != nil {
		if err = g.Manager.CheckVisibleCatalog(ctx, index); err != nil {
			return nil, err
		}
	}
	return result, nil
}
