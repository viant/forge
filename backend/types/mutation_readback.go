package types

import (
	"fmt"
	"strings"
)

func validateReadbackVerification(window *Window, owner string, command *MutationCommand, checkSources bool) error {
	spec := command.Reconcile
	verify := spec.Verify
	location := owner + ".reconcile.verify"
	if spec.Mode != "refetch" || command.ReceiptIdentity == nil {
		return fmt.Errorf("%s requires refetch mode and a writer receiptIdentity", location)
	}
	if strings.TrimSpace(command.DataSourceRef) == "" || strings.TrimSpace(spec.DataSourceRef) == "" || spec.DataSourceRef == command.DataSourceRef {
		return fmt.Errorf("%s requires distinct writer and reader datasources", location)
	}
	if checkSources {
		if _, ok := window.DataSource[command.DataSourceRef]; !ok {
			return fmt.Errorf("%s references unknown writer datasource %s", location, command.DataSourceRef)
		}
		reader, ok := window.DataSource[spec.DataSourceRef]
		if !ok {
			return fmt.Errorf("%s references unknown reader datasource %s", location, spec.DataSourceRef)
		}
		if reader.Service != nil {
			switch strings.ToUpper(strings.TrimSpace(reader.Service.Method)) {
			case "", "GET", "POST":
			default:
				return fmt.Errorf("%s requires a read transport for %s", location, spec.DataSourceRef)
			}
		}
	}
	if len(spec.IdentityFields) != 0 || spec.RowsPath != "" {
		return fmt.Errorf("%s uses identityField for reader IDs and resultPath for nested writer receipt rows", location)
	}
	for _, selector := range []string{spec.IdentityField, spec.ResultPath, verify.SubmittedRows} {
		if selector != "" && !validResourceSelector(selector) {
			return fmt.Errorf("%s contains an invalid selector %q", location, selector)
		}
	}
	if !validResourceSelector(verify.IDsParameter) || strings.Contains(verify.IDsParameter, ".") || len(verify.Scope) == 0 {
		return fmt.Errorf("%s requires a named idsParameter and at least one scope binding", location)
	}
	names := map[string]bool{verify.IDsParameter: true}
	scopeFields := make(map[string]bool, len(verify.Scope))
	for i, scope := range verify.Scope {
		if !validResourceSelector(scope.Field) || scopeFields[scope.Field] || scope.Parameter == nil {
			return fmt.Errorf("%s.scope[%d] requires a distinct reader field and a parameter", location, i)
		}
		scopeFields[scope.Field] = true
		name := scope.Parameter.Name
		if !validResourceSelector(name) || strings.Contains(name, ".") || names[name] {
			return fmt.Errorf("%s.scope[%d] requires a distinct parameter name", location, i)
		}
		names[name] = true
		if strings.EqualFold(scope.Parameter.Direction, "out") {
			return fmt.Errorf("%s.scope[%d] requires an input parameter", location, i)
		}
	}
	if verify.SubmittedRows != "" && !command.ReceiptIdentity.Generated && verify.SubmittedRows != command.ReceiptIdentity.SubmittedRows {
		return fmt.Errorf("%s.submittedRows must match receiptIdentity.submittedRows for an update", location)
	}
	if len(verify.Fields) > 0 && verify.SubmittedRows == "" && command.ReceiptIdentity.SubmittedRows == "" {
		return fmt.Errorf("%s.fields requires submittedRows to locate the submitted values", location)
	}
	for submitted, returned := range verify.Fields {
		if !validResourceSelector(submitted) || !validResourceSelector(returned) {
			return fmt.Errorf("%s.fields contains an invalid submitted or reader selector", location)
		}
	}
	for _, refresh := range command.Refresh {
		if refresh.DataSourceRef == spec.DataSourceRef || refresh.DataSourceRef == command.DataSourceRef {
			return fmt.Errorf("%s requires a refresh datasource distinct from the verification reader and writer", location)
		}
	}
	for _, step := range command.Before {
		if (step.Command != nil && step.Command.DataSourceRef == spec.DataSourceRef) ||
			(step.Cleanup != nil && step.Cleanup.DataSourceRef == spec.DataSourceRef) {
			return fmt.Errorf("%s may not use a preparation or cleanup writer as its reader", location)
		}
	}
	return nil
}
