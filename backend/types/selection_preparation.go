package types

import (
	"fmt"
	"strings"
)

// The effective dialog registry is assembled once per validation, and only for
// windows with a prepared selection. Source libraries can be merged after the
// earlier structure-only pass.
func selectionPreparationValidator(window *Window, bound bool) func(string, *EditableCollectionOperation) error {
	var dialogs map[string]*Dialog
	return func(owner string, op *EditableCollectionOperation) error {
		if err := validateSelectionPreparation(owner, op); err != nil {
			return err
		}
		spec := op.PrepareSelection
		if !bound {
			return nil
		}
		if _, ok := window.DataSource[spec.DataSourceRef]; !ok {
			return fmt.Errorf("%s.prepareSelection references unknown reader datasource %q", owner, spec.DataSourceRef)
		}
		if spec.MappingRef != "" {
			if _, ok := window.ResourceMappings[spec.MappingRef]; !ok {
				return fmt.Errorf("%s.prepareSelection references unknown resource mapping %q", owner, spec.MappingRef)
			}
		}
		if dialogs == nil {
			dialogs = make(map[string]*Dialog, len(window.Dialogs))
			for i := range window.Dialogs {
				d := &window.Dialogs[i]
				dialogs[d.Id] = d
			}
		}
		dialog := dialogs[op.DialogID]
		if dialog == nil {
			return fmt.Errorf("%s.prepareSelection references unknown dialog %q", owner, op.DialogID)
		}
		draft := dialog.DataSourceRef
		if draft != "" && dialog.Content != nil && dialog.Content.DataSourceRef != "" {
			if draft != dialog.Content.DataSourceRef {
				return fmt.Errorf("%s.prepareSelection dialog %q declares conflicting draft datasources", owner, op.DialogID)
			}
		}
		if draft == "" {
			return fmt.Errorf("%s.prepareSelection dialog %q requires a draft datasource", owner, op.DialogID)
		}
		source, ok := window.DataSource[draft]
		if !ok {
			return fmt.Errorf("%s.prepareSelection dialog %q references unknown draft datasource %q", owner, op.DialogID, draft)
		}
		// The regular dialog open path resets and reloads its form when it owns
		// the initial read. Such a read would replace this operation's draft.
		contentFetch := dialog.Content != nil && dialog.Content.FetchData != nil && *dialog.Content.FetchData
		openFetch := dialog.FetchOnOpen == nil && (dialog.Content == nil || dialog.Content.FetchData == nil || contentFetch)
		if dialog.FetchOnOpen != nil {
			openFetch = *dialog.FetchOnOpen
		}
		if openFetch || contentFetch || (source.AutoFetch != nil && *source.AutoFetch) {
			return fmt.Errorf("%s.prepareSelection dialog %q must retain the prepared draft on open; disable its draft fetch", owner, op.DialogID)
		}
		return validateParentDraftBindings(owner, window, op, draft)
	}
}

// A parent draft can consume local fields independently of the producer inputs.
func validateParentDraftBindings(owner string, window *Window, op *EditableCollectionOperation, draft string) error {
	spec := op.PrepareSelection
	if spec.ParentParameter == "" {
		return nil
	}
	draftTarget := draft + ":parameters"
	hasDraft := false
	for _, p := range op.Parameters {
		if p != nil && p.To == draftTarget {
			hasDraft = true
			break
		}
	}
	if !hasDraft {
		return nil
	}
	if draft == spec.DataSourceRef {
		return fmt.Errorf("%s.prepareSelection requires distinct reader and draft destinations", owner)
	}
	readerNames := map[string]bool{}
	draftNames := map[string]bool{}
	readerRoots := map[string]string{}
	for _, p := range op.Parameters {
		if p == nil {
			continue
		}
		if !validResourceSelector(p.Name) || p.Name == "..." {
			return fmt.Errorf("%s.prepareSelection requires named fields in scoped bindings", owner)
		}
		source, store, compact := strings.Cut(p.From, ":")
		if store == "collection" {
			if source != "" {
				if _, ok := window.DataSource[source]; !ok {
					return fmt.Errorf("%s.prepareSelection unknown collection source %q", owner, source)
				}
			}
			if p.Location != "" && !validResourceSelector(p.Location) {
				return fmt.Errorf("%s.prepareSelection unsafe collection field selector %q", owner, p.Location)
			}
		}
		target := p.To
		if target == "" {
			target = p.Kind
		}
		names := readerNames
		switch target {
		case draftTarget:
			names = draftNames
		case "", spec.DataSourceRef, spec.DataSourceRef + ":parameters":
			root, _, _ := strings.Cut(p.Name, ".")
			if prior, ok := readerRoots[root]; ok && prior != target {
				return fmt.Errorf("%s.prepareSelection ambiguous reader binding %q", owner, root)
			}
			readerRoots[root] = target
		default:
			return fmt.Errorf("%s.prepareSelection unknown parameter destination %q", owner, target)
		}
		if (strings.Contains(p.To, ":") && !compact) || p.Direction == "out" || store == "output" {
			return fmt.Errorf("%s.prepareSelection scoped bindings require an inbound source", owner)
		}
		if names[p.Name] {
			return fmt.Errorf("%s.prepareSelection duplicate binding %q", owner, p.Name)
		}
		names[p.Name] = true
	}
	if !readerNames[spec.ParentParameter] {
		return fmt.Errorf("%s.prepareSelection parentParameter must bind to the reader", owner)
	}
	for _, name := range spec.ScopeFields {
		if !readerNames[name] {
			return fmt.Errorf("%s.prepareSelection scope parameter %q must bind to the reader", owner, name)
		}
	}
	return nil
}

func validateSelectionPreparation(owner string, op *EditableCollectionOperation) error {
	spec := op.PrepareSelection
	if strings.TrimSpace(op.DialogID) == "" || op.Handler != "" || op.Mutation != nil {
		return fmt.Errorf("%s.prepareSelection requires a dialogId and cannot also declare a handler or mutation", owner)
	}
	if strings.TrimSpace(spec.DataSourceRef) == "" || strings.TrimSpace(spec.Prepare) == "" {
		return fmt.Errorf("%s.prepareSelection requires a reader dataSourceRef and a prepare handler", owner)
	}
	if spec.ParentParameter != "" {
		if spec.IDsParameter != "" || !topLevelSelectionField(spec.ParentParameter) || !validResourceSelector(spec.IdentityField) {
			return fmt.Errorf("%s.prepareSelection requires a safe parentParameter and identityField, without idsParameter", owner)
		}
	} else if !topLevelSelectionField(spec.IDsParameter) || !validResourceSelector(spec.IdentityField) {
		return fmt.Errorf("%s.prepareSelection requires a top-level idsParameter and a safe identityField", owner)
	}
	for _, field := range []string{spec.PendingField, spec.ErrorField} {
		if field != "" && !topLevelSelectionField(field) {
			return fmt.Errorf("%s.prepareSelection requires safe top-level pendingField and errorField names", owner)
		}
	}
	if spec.PendingField != "" && spec.PendingField == spec.ErrorField {
		return fmt.Errorf("%s.prepareSelection pendingField and errorField must be distinct", owner)
	}
	declared := make(map[string]bool, len(op.Parameters))
	for _, parameter := range op.Parameters {
		if parameter == nil {
			continue
		}
		if spec.IDsParameter != "" && parameter.Name == spec.IDsParameter {
			return fmt.Errorf("%s.prepareSelection idsParameter %q collides with an operation parameter", owner, spec.IDsParameter)
		}
		declared[parameter.Name] = true
	}
	if spec.ParentParameter != "" && !declared[spec.ParentParameter] {
		return fmt.Errorf("%s.prepareSelection parentParameter must name a declared operation parameter", owner)
	}
	for field, parameter := range spec.ScopeFields {
		if !validResourceSelector(field) || !topLevelSelectionField(parameter) || !declared[parameter] {
			return fmt.Errorf("%s.prepareSelection scopeFields requires a safe reader selector and a declared operation parameter: %q -> %q", owner, field, parameter)
		}
	}
	return nil
}

func topLevelSelectionField(name string) bool {
	return validResourceSelector(name) && !strings.Contains(name, ".")
}
