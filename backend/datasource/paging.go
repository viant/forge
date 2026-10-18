// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"encoding/json"
	"math"
	"math/big"
	"strconv"
	"strings"

	"github.com/viant/forge/backend/types"
)

func applyPaging(rows []map[string]interface{}, dataInfo map[string]interface{}, ds *types.DataSource, args map[string]interface{}) ([]map[string]interface{}, map[string]interface{}) {
	if ds == nil || ds.Paging == nil || !ds.Paging.Enabled || strings.EqualFold(ds.PaginationMode, "client") {
		return rows, dataInfo
	}

	if strings.TrimSpace(ds.Paging.Mode) != "" {
		return applyExplicitPaging(rows, dataInfo, ds, args)
	}

	pageName := "page"
	sizeName := "size"
	if ds.Paging.Parameters != nil {
		if ds.Paging.Parameters.Page != "" {
			pageName = ds.Paging.Parameters.Page
		}
		if ds.Paging.Parameters.Size != "" {
			sizeName = ds.Paging.Parameters.Size
		}
	}

	page := intArg(args, pageName, 1)
	if page < 1 {
		page = 1
	}
	pageSize := intArg(args, sizeName, ds.Paging.Size)
	if pageSize <= 0 {
		pageSize = ds.Paging.Size
	}
	if pageSize <= 0 {
		pageSize = len(rows)
	}
	if pageSize <= 0 {
		pageSize = 1
	}

	if dataInfo == nil {
		dataInfo = map[string]interface{}{}
	}
	if ds.Paging.OpenEnded {
		if strings.EqualFold(pageName, "offset") {
			offset := intArg(args, pageName, 0)
			if offset < 0 {
				offset = 0
			}
			page = offset/pageSize + 1
		}
		delete(dataInfo, "pageCount")
		delete(dataInfo, "totalPages")
		delete(dataInfo, "totalCount")
		delete(dataInfo, "recordCount")
		dataInfo["page"] = page
		dataInfo["pageSize"] = pageSize
		dataInfo["returnedCount"] = len(rows)
		dataInfo["hasMore"] = pageSize > 0 && len(rows) >= pageSize
		return rows, dataInfo
	}
	if strings.EqualFold(pageName, "offset") {
		offset := intArg(args, pageName, 0)
		if offset < 0 {
			offset = 0
		}
		page = 1
		if pageSize > 0 {
			page = (offset / pageSize) + 1
		}
		if _, known := explicitDataInfoTotalCount(dataInfo, ds); !known {
			dataInfo["page"] = page
			dataInfo["pageSize"] = pageSize
			dataInfo["returnedCount"] = len(rows)
			dataInfo["hasMore"] = pageSize > 0 && len(rows) >= pageSize
			return rows, dataInfo
		}
	}
	totalCount := dataInfoTotalCount(dataInfo, ds, len(rows))
	if totalCount <= 0 {
		totalCount = len(rows)
	}
	pageCount := int(math.Ceil(float64(totalCount) / float64(pageSize)))
	if pageCount <= 0 {
		pageCount = 1
	}

	if strings.EqualFold(pageName, "offset") {
		offset := intArg(args, pageName, 0)
		if offset < 0 {
			offset = 0
		}
		page = 1
		if pageSize > 0 {
			page = (offset / pageSize) + 1
		}
	} else {
		start := (page - 1) * pageSize
		if start < 0 {
			start = 0
		}
		if totalCount == len(rows) {
			if start >= len(rows) {
				rows = []map[string]interface{}{}
			} else {
				end := start + pageSize
				if end > len(rows) {
					end = len(rows)
				}
				rows = rows[start:end]
			}
		}
	}

	dataInfo["pageCount"] = pageCount
	dataInfo["totalCount"] = totalCount
	dataInfo["page"] = page
	dataInfo["pageSize"] = pageSize
	return rows, dataInfo
}

func explicitDataInfoTotalCount(dataInfo map[string]interface{}, ds *types.DataSource) (int, bool) {
	if dataInfo == nil {
		return 0, false
	}
	keys := []string{"totalCount", "recordCount"}
	if ds != nil && ds.Paging != nil && ds.Paging.DataInfoSelectors != nil {
		if key := strings.TrimSpace(ds.Paging.DataInfoSelectors.TotalCount); key != "" {
			keys = append([]string{key}, keys...)
		}
	}
	for _, key := range keys {
		if _, ok := dataInfo[key]; !ok {
			continue
		}
		return intArg(dataInfo, key, 0), true
	}
	return 0, false
}

func dataInfoTotalCount(dataInfo map[string]interface{}, ds *types.DataSource, fallback int) int {
	if dataInfo == nil {
		return fallback
	}
	if ds != nil && ds.Paging != nil && ds.Paging.DataInfoSelectors != nil {
		if key := strings.TrimSpace(ds.Paging.DataInfoSelectors.TotalCount); key != "" {
			if total := intArg(dataInfo, key, 0); total > 0 {
				return total
			}
		}
	}
	if total := intArg(dataInfo, "totalCount", 0); total > 0 {
		return total
	}
	if total := intArg(dataInfo, "recordCount", 0); total > 0 {
		return total
	}
	return fallback
}

func intArg(holder map[string]interface{}, key string, fallback int) int {
	if holder == nil {
		return fallback
	}
	value, ok := holder[key]
	if !ok {
		return fallback
	}
	switch actual := value.(type) {
	case int:
		return actual
	case int32:
		return int(actual)
	case int64:
		return int(actual)
	case float64:
		return int(actual)
	case float32:
		return int(actual)
	case json.Number:
		// Strict JSON decoders retain paging inputs as json.Number.
		if integer, err := actual.Int64(); err == nil {
			if strconv.IntSize == 32 && (integer < math.MinInt32 || integer > math.MaxInt32) {
				return fallback
			}
			return int(integer)
		}
		if number, err := actual.Float64(); err == nil && !math.IsNaN(number) && !math.IsInf(number, 0) {
			// Float-to-int conversion outside the representable range is
			// implementation-dependent and can wrap to a plausible page value.
			limit := math.Ldexp(1, strconv.IntSize-1)
			if number < -limit || number >= limit {
				return fallback
			}
			// Float64 can round values just below the signed minimum up to
			// -limit. Compare the original decimal exactly only at that boundary.
			if number == -limit {
				if exact, ok := new(big.Rat).SetString(actual.String()); ok {
					lower := new(big.Rat).SetInt(new(big.Int).Neg(new(big.Int).Lsh(big.NewInt(1), uint(strconv.IntSize-1))))
					if exact.Cmp(lower) < 0 {
						return fallback
					}
				}
			}
			return int(number)
		}
		return fallback
	default:
		return fallback
	}
}
