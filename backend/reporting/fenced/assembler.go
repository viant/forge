package fenced

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
)

const (
	maxReports     = 4
	maxFragments   = 64
	maxBlocks      = 100
	maxDataSources = 32
	maxRows        = 10000
)

var safeSegment = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

type envelope struct {
	Version        int              `json:"version"`
	Scope          string           `json:"scope"`
	ID             string           `json:"id"`
	ReportRef      string           `json:"reportRef"`
	Sequence       int              `json:"sequence"`
	Mode           string           `json:"mode"`
	Grammar        string           `json:"grammar"`
	Target         map[string]any   `json:"target"`
	Blocks         []map[string]any `json:"blocks"`
	RemoveBlockIDs []string         `json:"removeBlockIds"`
	Format         string           `json:"format"`
	Data           json.RawMessage  `json:"data"`
	Raw            map[string]any   `json:"-"`
}

type state struct {
	assembly  Assembly
	started   bool
	committed bool
	seen      map[int]string
	fragments int
}

func Assemble(fences []Fence, reportID string) (*CompileResult, error) {
	states := map[string]*state{}
	var diagnostics []Diagnostic
	for _, fence := range fences {
		var payload envelope
		if err := json.Unmarshal(fence.Payload, &payload); err != nil {
			diagnostics = append(diagnostics, diagnostic("REPORT_FENCE_INVALID", err.Error(), "", 0))
			continue
		}
		if err := json.Unmarshal(fence.Payload, &payload.Raw); err != nil {
			diagnostics = append(diagnostics, diagnostic("REPORT_FENCE_INVALID", err.Error(), "", payload.Sequence))
			continue
		}
		id := strings.TrimSpace(payload.ID)
		if fence.Kind == DataFence {
			id = strings.TrimSpace(payload.ReportRef)
		}
		scope := strings.TrimSpace(payload.Scope)
		if scope == "" {
			scope = "message"
		}
		if id == "" || !safeSegment.MatchString(id) || !safeSegment.MatchString(scope) {
			diagnostics = append(diagnostics, diagnostic("REPORT_ID_INVALID", "scope and report id must use letters, numbers, dots, underscores, or hyphens", id, payload.Sequence))
			continue
		}
		if reportID != "" && id != reportID {
			continue
		}
		key := scope + ":" + id
		current := states[key]
		if current == nil {
			if len(states) >= maxReports {
				diagnostics = append(diagnostics, diagnostic("REPORT_LIMIT_EXCEEDED", "no more than four reports may be assembled", id, payload.Sequence))
				continue
			}
			current = &state{assembly: Assembly{Scope: scope, ID: id, Status: "pending", Source: map[string]any{}, DataSources: map[string]json.RawMessage{}}, seen: map[int]string{}}
			states[key] = current
		}
		if payload.Sequence <= 0 {
			diagnostics = append(diagnostics, diagnostic("REPORT_SEQUENCE_REQUIRED", "progressive transactions require a positive sequence", id, payload.Sequence))
			continue
		}
		canonicalRaw, _ := json.Marshal(payload.Raw)
		canonical := string(canonicalRaw)
		if prior, ok := current.seen[payload.Sequence]; ok {
			if prior != canonical {
				diagnostics = append(diagnostics, diagnostic("REPORT_SEQUENCE_CONFLICT", "sequence was replayed with different content", id, payload.Sequence))
			}
			continue
		}
		if current.committed {
			diagnostics = append(diagnostics, diagnostic("REPORT_ALREADY_COMMITTED", "report assembly is already committed", id, payload.Sequence))
			continue
		}
		if payload.Sequence < current.assembly.Sequence {
			diagnostics = append(diagnostics, diagnostic("REPORT_SEQUENCE_STALE", "a lower sequence arrived after a newer transaction", id, payload.Sequence))
			continue
		}
		if current.fragments >= maxFragments {
			diagnostics = append(diagnostics, diagnostic("REPORT_FRAGMENT_LIMIT_EXCEEDED", "report transaction limit exceeded", id, payload.Sequence))
			continue
		}
		candidate := cloneState(current)
		var err error
		if fence.Kind == ReportFence {
			err = applyReport(candidate, payload)
		} else if fence.Kind == DataFence {
			err = applyData(candidate, payload)
		} else {
			err = fmt.Errorf("unsupported fence kind %q", fence.Kind)
		}
		if err != nil {
			diagnostics = append(diagnostics, diagnostic("REPORT_TRANSACTION_INVALID", err.Error(), id, payload.Sequence))
			continue
		}
		candidate.seen[payload.Sequence] = canonical
		candidate.assembly.Sequence = payload.Sequence
		candidate.fragments++
		states[key] = candidate
	}
	keys := make([]string, 0, len(states))
	for key := range states {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var chosen *Assembly
	for _, key := range keys {
		current := states[key]
		if !current.started {
			current.assembly.Status = "orphaned"
			diagnostics = append(diagnostics, diagnostic("REPORT_DATA_ORPHANED", "report data has no matching start transaction", current.assembly.ID, current.assembly.Sequence))
		} else if !current.committed {
			current.assembly.Status = "incomplete"
			diagnostics = append(diagnostics, diagnostic("REPORT_NOT_COMMITTED", "report is missing a commit transaction", current.assembly.ID, current.assembly.Sequence))
		}
		if chosen == nil || current.assembly.Status == "committed" {
			copy := current.assembly
			chosen = &copy
		}
	}
	if chosen == nil {
		return &CompileResult{Diagnostics: diagnostics}, fmt.Errorf("no matching fenced report found")
	}
	return &CompileResult{Assembly: chosen, Diagnostics: diagnostics}, nil
}

func applyReport(s *state, p envelope) error {
	if p.Version != 1 {
		return fmt.Errorf("unsupported forge-report version %d", p.Version)
	}
	mode := strings.ToLower(strings.TrimSpace(p.Mode))
	switch mode {
	case "start":
		if s.started {
			return fmt.Errorf("report start was already accepted")
		}
		grammar := strings.ToLower(strings.TrimSpace(p.Grammar))
		if grammar == "" {
			grammar = "dashboard-v1"
		}
		if grammar != "report-document-v1" && grammar != "dashboard-v1" {
			return fmt.Errorf("unsupported report grammar %q", grammar)
		}
		s.started = true
		s.assembly.Grammar = grammar
		s.assembly.Status = "rendering"
		s.assembly.Source = reportSource(p.Raw)
	case "append":
		if !s.started {
			return fmt.Errorf("report append requires an accepted start transaction")
		}
		if err := appendReportBlocks(s.assembly.Source, p.Blocks, p.Target); err != nil {
			return err
		}
		blocks, _ := s.assembly.Source["blocks"].([]any)
		if len(blocks) > maxBlocks {
			return fmt.Errorf("report block limit exceeded")
		}
	case "patch":
		if !s.started {
			return fmt.Errorf("report patch requires an accepted start transaction")
		}
		patch := reportSource(p.Raw)
		if incoming, ok := patch["blocks"].([]any); ok {
			delete(patch, "blocks")
			for _, value := range incoming {
				blockPatch, ok := value.(map[string]any)
				if !ok {
					return fmt.Errorf("block patches must be objects")
				}
				id := textValue(blockPatch["id"])
				block := findReportBlock(s.assembly.Source["blocks"], id)
				if block == nil {
					return fmt.Errorf("patch references unknown block %q", id)
				}
				mergeJSON(block, blockPatch)
			}
		}
		mergeJSON(s.assembly.Source, patch)
		for _, id := range p.RemoveBlockIDs {
			s.assembly.Source["blocks"] = removeReportBlock(s.assembly.Source["blocks"], id)
		}
		if err := validateReportBlocks(s.assembly.Source); err != nil {
			return err
		}
	case "replace":
		if !s.started {
			return fmt.Errorf("report replace requires an accepted start transaction")
		}
		if strings.TrimSpace(p.Grammar) == "" {
			return fmt.Errorf("report replace must restate the established grammar")
		}
		if strings.ToLower(strings.TrimSpace(p.Grammar)) != s.assembly.Grammar {
			return fmt.Errorf("report grammar is immutable after start")
		}
		replacement := reportSource(p.Raw)
		if err := validateReportBlocks(replacement); err != nil {
			return err
		}
		s.assembly.Source = replacement
	case "commit":
		if !s.started {
			return fmt.Errorf("report commit requires an accepted start transaction")
		}
		for sequence := 1; sequence < p.Sequence; sequence++ {
			if _, ok := s.seen[sequence]; !ok {
				return fmt.Errorf("cannot commit with missing sequence %d", sequence)
			}
		}
		s.committed = true
		s.assembly.Status = "committed"
	default:
		return fmt.Errorf("unsupported report mode %q", mode)
	}
	return nil
}

func applyData(s *state, p envelope) error {
	if p.Version != 2 {
		return fmt.Errorf("progressive forge-data requires version 2")
	}
	id := strings.TrimSpace(p.ID)
	if id == "" || !safeSegment.MatchString(id) {
		return fmt.Errorf("invalid datasource id %q", id)
	}
	if len(s.assembly.DataSources) >= maxDataSources {
		if _, ok := s.assembly.DataSources[id]; !ok {
			return fmt.Errorf("report datasource limit exceeded")
		}
	}
	format := strings.ToLower(strings.TrimSpace(p.Format))
	if format == "" {
		format = "json"
	}
	if format != "json" {
		return fmt.Errorf("backend fenced compiler currently requires JSON forge-data")
	}
	var incoming any
	if err := json.Unmarshal(p.Data, &incoming); err != nil {
		return fmt.Errorf("invalid datasource %q: %w", id, err)
	}
	mode := strings.ToLower(strings.TrimSpace(p.Mode))
	if mode == "" {
		mode = "replace"
	}
	var next any = incoming
	if existingRaw, ok := s.assembly.DataSources[id]; ok && mode != "replace" {
		var existing any
		_ = json.Unmarshal(existingRaw, &existing)
		switch mode {
		case "append":
			left, lok := existing.([]any)
			right, rok := incoming.([]any)
			if !lok || !rok {
				return fmt.Errorf("append requires row arrays")
			}
			next = append(left, right...)
		case "patch":
			left, lok := existing.(map[string]any)
			right, rok := incoming.(map[string]any)
			if !lok || !rok {
				return fmt.Errorf("patch requires JSON objects")
			}
			for key, value := range right {
				left[key] = value
			}
			next = left
		default:
			return fmt.Errorf("unsupported forge-data mode %q", mode)
		}
	} else if mode != "replace" && mode != "append" && mode != "patch" {
		return fmt.Errorf("unsupported forge-data mode %q", mode)
	}
	if rows, ok := next.([]any); ok && len(rows) > maxRows {
		return fmt.Errorf("datasource %q row limit exceeded", id)
	}
	raw, _ := json.Marshal(next)
	s.assembly.DataSources[id] = raw
	return nil
}

func reportSource(raw map[string]any) map[string]any {
	result := map[string]any{}
	for key, value := range raw {
		switch key {
		case "version", "scope", "id", "sequence", "mode", "grammar", "target", "removeBlockIds":
		default:
			result[key] = value
		}
	}
	if _, ok := result["blocks"]; !ok {
		result["blocks"] = []any{}
	}
	return result
}

func appendReportBlocks(source map[string]any, incoming []map[string]any, target map[string]any) error {
	targetKind, targetRef, targetSlot, position := "report", "root", "", "append"
	if target != nil {
		if value := textValue(target["kind"]); value != "" {
			targetKind = value
		}
		if value := textValue(target["ref"]); value != "" {
			targetRef = value
		}
		targetSlot = textValue(target["slot"])
		if value := textValue(target["position"]); value != "" {
			position = value
		}
	}
	if position != "append" {
		return fmt.Errorf("unsupported target position %q", position)
	}
	if targetKind == "report" {
		if targetRef != "root" {
			return fmt.Errorf("the report root supports ref root only")
		}
	} else if targetKind == "block" {
		parent := findReportBlock(source["blocks"], targetRef)
		if parent == nil {
			return fmt.Errorf("target block %q does not exist", targetRef)
		}
		parentKind := textValue(parent["kind"])
		if targetSlot != "childBlockIds" && targetSlot != "sectionIds" {
			return fmt.Errorf("unsupported target slot %q", targetSlot)
		}
		if targetSlot == "childBlockIds" && parentKind != "compositeBlock" {
			return fmt.Errorf("childBlockIds requires a compositeBlock target")
		}
		if targetSlot == "sectionIds" && parentKind != "tabGroupBlock" {
			return fmt.Errorf("sectionIds requires a tabGroupBlock target")
		}
		ids, _ := parent[targetSlot].([]any)
		for _, block := range incoming {
			if targetSlot == "sectionIds" && textValue(block["kind"]) != "sectionBlock" {
				return fmt.Errorf("sectionIds accepts sectionBlock entries only")
			}
			ids = append(ids, textValue(block["id"]))
		}
		parent[targetSlot] = ids
	} else {
		return fmt.Errorf("unsupported target kind %q", targetKind)
	}
	blocks, _ := source["blocks"].([]any)
	for _, block := range incoming {
		if id := textValue(block["id"]); id == "" {
			return fmt.Errorf("appended blocks require an id")
		} else if findReportBlock(blocks, id) != nil {
			return fmt.Errorf("duplicate block id %q", id)
		}
		blocks = append(blocks, block)
	}
	source["blocks"] = blocks
	return validateReportBlocks(source)
}

func validateReportBlocks(source map[string]any) error {
	seen := map[string]bool{}
	blocks, _ := source["blocks"].([]any)
	for _, value := range blocks {
		block, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("report blocks must be objects")
		}
		id := textValue(block["id"])
		if id == "" {
			return fmt.Errorf("report blocks require an id")
		}
		if seen[id] {
			return fmt.Errorf("duplicate block id %q", id)
		}
		seen[id] = true
	}
	return nil
}

func findReportBlock(value any, id string) map[string]any {
	blocks, _ := value.([]any)
	for _, value := range blocks {
		block, _ := value.(map[string]any)
		if textValue(block["id"]) == strings.TrimSpace(id) {
			return block
		}
	}
	return nil
}

func removeReportBlock(value any, id string) any {
	blocks, ok := value.([]any)
	if !ok {
		return value
	}
	result := make([]any, 0, len(blocks))
	for _, value := range blocks {
		block, _ := value.(map[string]any)
		if textValue(block["id"]) != strings.TrimSpace(id) {
			result = append(result, value)
		}
	}
	return result
}

func mergeJSON(target, patch map[string]any) map[string]any {
	for key, value := range patch {
		if value == nil {
			delete(target, key)
			continue
		}
		patchObject, patchOK := value.(map[string]any)
		targetObject, targetOK := target[key].(map[string]any)
		if patchOK && targetOK {
			target[key] = mergeJSON(targetObject, patchObject)
			continue
		}
		target[key] = value
	}
	return target
}

func cloneState(input *state) *state {
	raw, _ := json.Marshal(input.assembly)
	var assembly Assembly
	_ = json.Unmarshal(raw, &assembly)
	seen := map[int]string{}
	for key, value := range input.seen {
		seen[key] = value
	}
	return &state{assembly: assembly, started: input.started, committed: input.committed, seen: seen, fragments: input.fragments}
}

func diagnostic(code, message, reportID string, sequence int) Diagnostic {
	return Diagnostic{Code: code, Severity: "error", Message: message, ReportID: reportID, Sequence: sequence}
}
