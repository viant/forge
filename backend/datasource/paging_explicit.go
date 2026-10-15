// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/types"
	"math"
	"strings"
)

func validateExplicitPaging(ds *types.DataSource) error {
	if ds == nil || ds.Paging == nil || !ds.Paging.Enabled {
		return nil
	}
	switch strings.ToLower(strings.TrimSpace(ds.Paging.Mode)) {
	case "", "page", "offset":
		return nil
	case "cursor":
		if ds.Paging.Parameters == nil || ds.Paging.Parameters.Page == "" || ds.Paging.DataInfoSelectors == nil || ds.Paging.DataInfoSelectors.HasMore == "" || ds.Paging.DataInfoSelectors.NextCursor == "" {
			return fmt.Errorf("cursor paging requires authored token parameter and hasMore/nextCursor selectors")
		}
		return nil
	default:
		return fmt.Errorf("unsupported datasource paging mode %q", ds.Paging.Mode)
	}
}

// Explicit modes describe already paged upstream results. They never slice the
// received rows or invent tool arguments; the caller supplies authored fields.
func applyExplicitPaging(rows []map[string]interface{}, info map[string]interface{}, ds *types.DataSource, args map[string]interface{}) ([]map[string]interface{}, map[string]interface{}) {
	out := map[string]interface{}{}
	for key, value := range info {
		out[key] = value
	}
	if selectors := ds.Paging.DataInfoSelectors; selectors != nil && selectors.HasMore != "" {
		out["hasMore"] = selectPath(selectors.HasMore, info)
	}
	if strings.EqualFold(strings.TrimSpace(ds.Paging.Mode), "cursor") {
		selectors := ds.Paging.DataInfoSelectors
		out["hasMore"] = selectPath(selectors.HasMore, info)
		out["nextCursor"] = selectPath(selectors.NextCursor, info)
		out["returnedCount"] = len(rows)
		return rows, out
	}
	position, sizeName := "page", "size"
	if p := ds.Paging.Parameters; p != nil {
		if p.Page != "" {
			position = p.Page
		}
		if p.Size != "" {
			sizeName = p.Size
		}
	}
	size := intArg(args, sizeName, ds.Paging.Size)
	if size <= 0 {
		size = len(rows)
	}
	if size <= 0 {
		size = 1
	}
	page, offset := 1, 0
	mode := strings.ToLower(strings.TrimSpace(ds.Paging.Mode))
	if mode == "offset" {
		offset = intArg(args, position, 0)
		if offset < 0 {
			offset = 0
		}
		page = offset/size + 1
	} else {
		page = intArg(args, position, 1)
		if page < 1 {
			page = 1
		}
		offset = (page - 1) * size
	}
	out["page"], out["pageSize"], out["returnedCount"] = page, size, len(rows)
	total, known := explicitDataInfoTotalCount(info, ds)
	if ds.Paging.OpenEnded {
		delete(out, "pageCount")
		delete(out, "totalPages")
		delete(out, "totalCount")
		delete(out, "recordCount")
		known = false
	}
	if known {
		out["totalCount"] = total
		count := int(math.Ceil(float64(total) / float64(size)))
		if count < 1 {
			count = 1
		}
		out["pageCount"] = count
	}
	if _, present := out["hasMore"].(bool); !present {
		if known {
			out["hasMore"] = offset+len(rows) < total
		} else {
			out["hasMore"] = len(rows) >= size
		}
	}
	return rows, out
}

func validatePagingDataInfo(ds *types.DataSource, info map[string]interface{}, inputs ...map[string]interface{}) error {
	if ds == nil || ds.Paging == nil || !ds.Paging.Enabled || strings.TrimSpace(ds.Paging.Mode) == "" {
		return nil
	}
	mode := strings.ToLower(strings.TrimSpace(ds.Paging.Mode))
	if mode != "cursor" && (ds.Paging.DataInfoSelectors == nil || ds.Paging.DataInfoSelectors.HasMore == "") {
		return nil
	}

	selectors := ds.Paging.DataInfoSelectors
	more, ok := selectPath(selectors.HasMore, info).(bool)
	if !ok {
		return fmt.Errorf("explicit paging result requires a boolean hasMore")
	}
	if mode != "cursor" {
		return nil
	}
	token := selectPath(selectors.NextCursor, info)
	if more && (token == nil || isEmptyCursorString(token)) {
		return fmt.Errorf("cursor result is missing nextCursor")
	}
	if more {
		encoded, err := json.Marshal(token)
		if err != nil {
			return fmt.Errorf("cursor result has invalid nextCursor: %w", err)
		}
		if len(inputs) > 0 {
			if current, present := inputs[0][ds.Paging.Parameters.Page]; present {
				previous, err := json.Marshal(current)
				if err != nil {
					return err
				}
				if bytes.Equal(previous, encoded) {
					return fmt.Errorf("cursor result repeated current continuation token")
				}
			}
		}
	}
	return nil
}

func isEmptyCursorString(token interface{}) bool { text, ok := token.(string); return ok && text == "" }
