package reporting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/materializer"
	"io"
	"math"
	"math/big"
	"strconv"
	"strings"
)

const maxResourceDatasetRows = 10000
const maxResourceDatasetBytes = 8 << 20
const maxResourceDatasetPages = 1000

func normalizeReportPageResult(result *dsproto.FetchResult, descriptor *dsproto.DataSource, contract json.RawMessage) (*dsproto.FetchResult, error) {
	if result == nil || descriptor.Paging.DataInfoSelectors == nil || descriptor.Paging.DataInfoSelectors.HasMore == "" {
		return nil, fmt.Errorf("report page requires explicit completeness metadata")
	}
	more, ok := reportPagingValue(result.DataInfo, descriptor.Paging.DataInfoSelectors.HasMore).(bool)
	if !ok {
		return nil, fmt.Errorf("report page requires boolean hasMore")
	}
	raw, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	normalized, err := materializer.NormalizeDatasetResult(contract, raw)
	if err != nil {
		return nil, err
	}
	var body struct {
		Rows []map[string]interface{} `json:"rows"`
	}
	if err := decodeReportPagingJSON(normalized, &body); err != nil {
		return nil, err
	}
	copy := *result
	copy.Rows = body.Rows
	copy.DataInfo = make(map[string]interface{}, len(result.DataInfo)+1)
	for key, value := range result.DataInfo {
		copy.DataInfo[key] = value
	}
	copy.DataInfo["hasMore"] = more
	return &copy, nil
}

// Explicit paging opts into complete aggregation. Legacy mode remains one call.
// check retains the original selected resource and narrowed lease around every
// page; no partial aggregate is returned on a failed guard or continuation.
func fetchCompleteResourceDataset(ctx context.Context, descriptor *dsproto.DataSource, inputs map[string]interface{}, check func() error, fetch func(*dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error)) (*dsproto.FetchResult, error) {
	if descriptor == nil || descriptor.Backend == nil || descriptor.ID == "" || check == nil || fetch == nil {
		return nil, fmt.Errorf("report datasource requires a valid descriptor, backend and executor")
	}
	mode := ""
	if descriptor.Paging != nil && descriptor.Paging.Enabled {
		mode = strings.ToLower(strings.TrimSpace(descriptor.Paging.Mode))
	}
	if mode == "" {
		return fetch(descriptor, inputs)
	}
	if mode != "page" && mode != "offset" && mode != "cursor" {
		return nil, fmt.Errorf("unsupported report datasource paging mode %q", mode)
	}
	config := descriptor.Paging
	if config.Parameters == nil || config.Parameters.Page == "" || config.DataInfoSelectors == nil || config.DataInfoSelectors.HasMore == "" || mode == "cursor" && config.DataInfoSelectors.NextCursor == "" {
		return nil, fmt.Errorf("complete report paging requires authored position parameter and continuation selectors")
	}
	position := config.Parameters.Page
	if _, pinned := descriptor.Backend.Pinned[position]; pinned {
		return nil, fmt.Errorf("report continuation parameter cannot be pinned")
	}
	frozen, err := json.Marshal(descriptor)
	if err != nil {
		return nil, err
	}
	inputBytes, err := json.Marshal(inputs)
	if err != nil {
		return nil, err
	}
	args := map[string]interface{}{}
	if string(inputBytes) != "null" {
		if err = decodeReportPagingJSON(inputBytes, &args); err != nil {
			return nil, err
		}
	}
	if mode == "cursor" {
		delete(args, position)
	} else if _, present := args[position]; !present {
		if mode == "offset" {
			args[position] = 0
		} else {
			args[position] = 1
		}
	}
	if mode != "cursor" {
		value, err := reportPagingInteger(args[position])
		if err != nil {
			return nil, err
		}
		expected := int64(0)
		if mode == "page" {
			expected = 1
		}
		if value != expected {
			return nil, fmt.Errorf("complete report must start at initial page")
		}
	}
	if config.Parameters.Size != "" {
		if _, present := args[config.Parameters.Size]; !present && config.Size > 0 {
			args[config.Parameters.Size] = config.Size
		}
	}
	aggregate := &dsproto.FetchResult{Rows: []map[string]interface{}{}}
	used := map[string]bool{}
	dataBytes := 0
	for page := 0; page < maxResourceDatasetPages; page++ {
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		if err = check(); err != nil {
			return nil, err
		}
		var exact dsproto.DataSource
		if err = decodeReportPagingJSON(frozen, &exact); err != nil {
			return nil, err
		}
		callBytes, e := json.Marshal(args)
		if e != nil {
			return nil, e
		}
		callArgs := map[string]interface{}{}
		if e = decodeReportPagingJSON(callBytes, &callArgs); e != nil {
			return nil, e
		}
		result, e := fetch(&exact, callArgs)
		if e != nil {
			return nil, e
		}
		if result == nil {
			return nil, fmt.Errorf("report datasource returned no result")
		}
		if err = check(); err != nil {
			return nil, err
		}
		more, ok := reportPagingValue(result.DataInfo, config.DataInfoSelectors.HasMore).(bool)
		if !ok {
			return nil, fmt.Errorf("report datasource has unknown completeness: explicit boolean hasMore required")
		}
		encoded, e := json.Marshal(result.Rows)
		if e != nil {
			return nil, e
		}
		if len(aggregate.Rows)+len(result.Rows) > maxResourceDatasetRows || len(encoded) > maxResourceDatasetBytes-dataBytes {
			return nil, fmt.Errorf("report datasource exceeds complete-fetch row or byte bound")
		}
		dataBytes += len(encoded)
		aggregate.Rows = append(aggregate.Rows, result.Rows...)
		aggregate.DataInfo = result.DataInfo
		aggregate.Metrics = result.Metrics
		if !more {
			if err = check(); err != nil {
				return nil, err
			}
			return aggregate, nil
		}
		if len(result.Rows) == 0 {
			return nil, fmt.Errorf("report datasource continued without progress")
		}
		if mode == "cursor" {
			token := reportPagingValue(result.DataInfo, config.DataInfoSelectors.NextCursor)
			text, empty := token.(string)
			if token == nil || empty && text == "" {
				return nil, fmt.Errorf("report datasource is missing next cursor")
			}
			raw, e := json.Marshal(token)
			if e != nil {
				return nil, e
			}
			key := string(raw)
			if used[key] {
				return nil, fmt.Errorf("report datasource repeated a cursor")
			}
			used[key] = true
			args[position] = token
		} else {
			number, err := reportPagingInteger(args[position])
			if err != nil || number < 0 {
				return nil, fmt.Errorf("report paging position must be a nonnegative integer")
			}
			step := int64(1)
			if mode == "offset" {
				step = int64(len(result.Rows))
			}
			if number > math.MaxInt64-step {
				return nil, fmt.Errorf("report paging position overflow")
			}
			args[position] = json.Number(strconv.FormatInt(number+step, 10))
		}
	}
	return nil, fmt.Errorf("report datasource exceeds complete-fetch page bound")
}

func reportPagingValue(info map[string]interface{}, path string) interface{} {
	var value interface{} = info
	for _, part := range strings.Split(path, ".") {
		object, ok := value.(map[string]interface{})
		if !ok {
			return nil
		}
		value = object[part]
	}
	return value
}

func decodeReportPagingJSON(body []byte, target interface{}) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.UseNumber()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var extra interface{}
	if err := decoder.Decode(&extra); err != io.EOF {
		return fmt.Errorf("report JSON must contain one value")
	}
	return nil
}
func reportPagingInteger(value interface{}) (int64, error) {
	switch n := value.(type) {
	case int:
		return int64(n), nil
	case int64:
		return n, nil
	case json.Number:
		rational, ok := new(big.Rat).SetString(n.String())
		if !ok || !rational.IsInt() || !rational.Num().IsInt64() {
			break
		}
		return rational.Num().Int64(), nil
	case float64:
		if math.IsNaN(n) || math.IsInf(n, 0) || math.Trunc(n) != n || math.Abs(n) > 9007199254740991 {
			break
		}
		return int64(n), nil
	}
	return 0, fmt.Errorf("report paging position must be an exact integer")
}
func explicitReportPaging(descriptor *dsproto.DataSource) bool {
	return descriptor != nil && descriptor.Paging != nil && descriptor.Paging.Enabled && strings.TrimSpace(descriptor.Paging.Mode) != ""
}
func decodeReportDatasource(body []byte, target *dsproto.DataSource) error {
	var mode struct {
		Paging *struct {
			Enabled bool   `json:"enabled"`
			Mode    string `json:"mode"`
		}
	}
	if err := json.Unmarshal(body, &mode); err != nil {
		return err
	}
	if mode.Paging != nil && mode.Paging.Enabled && strings.TrimSpace(mode.Paging.Mode) != "" {
		return decodeReportPagingJSON(body, target)
	}
	return json.Unmarshal(body, target)
}

// A viewer may move only the authored offset position; scope, projection, limits
// and pinned inputs remain the responsibility of the admitted report plan.
func applyReportDatasetOffset(descriptor *dsproto.DataSource, inputs map[string]interface{}, offset int) error {
	if offset < 0 || offset >= maxResourceDatasetRows {
		return fmt.Errorf("report offset exceeds row bound")
	}
	if descriptor == nil || descriptor.Backend == nil || descriptor.Paging == nil || !descriptor.Paging.Enabled || descriptor.Paging.Mode != "offset" || descriptor.Paging.Parameters == nil || descriptor.Paging.Parameters.Page == "" {
		return fmt.Errorf("report dataset does not support authored offset paging")
	}
	position := descriptor.Paging.Parameters.Page
	if _, pinned := descriptor.Backend.Pinned[position]; pinned {
		return fmt.Errorf("report offset cannot replace pinned input")
	}
	if inputs == nil {
		return fmt.Errorf("report page inputs unavailable")
	}
	inputs[position] = offset
	return nil
}
