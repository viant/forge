package types

import (
	"fmt"
	"strconv"
	"strings"
)

func validatePreparationSteps(window *Window, owner, fallbackID string, root *MutationCommand, checkSources bool) error {
	if root == nil {
		return nil
	}
	if err := validateWriterReceipt(root, owner); err != nil {
		return err
	}
	for field := range root.SuccessFormState {
		if !validResourceSelector(field) || strings.Contains(field, ".") {
			return fmt.Errorf("%s.successFormState requires safe top-level field names", owner)
		}
	}
	if len(root.ClearFormFields) > 0 {
		seen := make(map[string]bool, len(root.ClearFormFields))
		for _, field := range root.ClearFormFields {
			if !validResourceSelector(field) || strings.Contains(field, ".") || seen[field] {
				return fmt.Errorf("%s.clearFormFields requires distinct, safe top-level field names", owner)
			}
			if _, both := root.SuccessFormState[field]; both {
				return fmt.Errorf("%s field %q occurs in both clearFormFields and successFormState", owner, field)
			}
			seen[field] = true
		}
	}
	if len(root.Before) == 0 {
		return nil
	}
	rootID := root.CommandID
	if rootID == "" {
		rootID = fallbackID
	}
	if rootID == "" {
		rootID = root.DataSourceRef
	}
	rootID = strings.TrimSpace(rootID)
	if err := validatePreparationWriter(window, owner, root, checkSources); err != nil {
		return err
	}
	ids := map[string]bool{rootID: true}
	validate := func(command *MutationCommand, location string) error {
		if command == nil {
			return fmt.Errorf("%s requires a command", location)
		}
		id := command.CommandID
		if !validResourceSelector(id) || strings.Contains(id, ".") || ids[id] {
			return fmt.Errorf("%s requires a distinct commandId usable as one selector segment", location)
		}
		ids[id] = true
		if len(command.Before) > 0 || len(command.ClearFormFields) > 0 || command.Confirm != "" || command.ConfirmSelection != nil || command.SerializationGroup != "" ||
			len(command.PendingState)+len(command.SuccessState)+len(command.SuccessFormState)+len(command.ResultState)+len(command.ErrorState)+len(command.IndeterminateState)+len(command.CleanupState) > 0 ||
			len(command.Refresh) > 0 || command.Reconcile != nil {
			return fmt.Errorf("%s: confirmation, sequencing and result lifecycle belong to the root command", location)
		}
		return validatePreparationWriter(window, location, command, checkSources)
	}
	for i, step := range root.Before {
		location := fmt.Sprintf("%s.before[%d]", owner, i)
		if err := validate(step.Command, location+".command"); err != nil {
			return err
		}
		if err := validateWriterReceipt(step.Command, location+".command"); err != nil {
			return err
		}
		if step.Cleanup != nil {
			if err := validate(step.Cleanup, location+".cleanup"); err != nil {
				return err
			}
			if step.Cleanup.ReceiptIdentity != nil {
				return fmt.Errorf("%s.cleanup.receiptIdentity is only supported on the root or a preparation command", location)
			}
			if step.Cleanup.RejectedWhen != nil {
				return fmt.Errorf("%s.cleanup.rejectedWhen is only supported on the root or a preparation command", location)
			}
			if step.Cleanup.ReceiptWhen != nil {
				if err := validateConditionTree(step.Cleanup.ReceiptWhen, location+".cleanup.receiptWhen", validateReceiptLeaf); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// Ordered invocations require a bound writer even when their input is prepared by a hook.
func validatePreparationWriter(window *Window, owner string, command *MutationCommand, checkSources bool) error {
	if strings.TrimSpace(command.DataSourceRef) == "" {
		return fmt.Errorf("%s requires a writer datasource", owner)
	}
	if command.Payload != nil {
		return validateCommandPayload(window, owner, command, checkSources)
	}
	if checkSources {
		if _, ok := window.DataSource[command.DataSourceRef]; !ok {
			return fmt.Errorf("%s references unknown datasource %s", owner, command.DataSourceRef)
		}
	}
	return nil
}

func validateWriterReceipt(command *MutationCommand, owner string) error {
	if identity := command.ReceiptIdentity; identity != nil {
		if !validResourceSelector(identity.Field) || identity.Generated == (identity.SubmittedRows != "") ||
			(identity.SubmittedRows != "" && !validResourceSelector(identity.SubmittedRows)) ||
			(identity.SubmittedField != "" && (identity.Generated || !validResourceSelector(identity.SubmittedField))) {
			return fmt.Errorf("%s.receiptIdentity requires a safe field and either generated or a submitted row selector", owner)
		}
	}
	if command.ReceiptWhen != nil {
		if err := validateConditionTree(command.ReceiptWhen, owner+".receiptWhen", validateReceiptLeaf); err != nil {
			return err
		}
	}
	if command.RejectedWhen == nil {
		return nil
	}
	if command.ReceiptWhen == nil && command.ReceiptIdentity == nil {
		return fmt.Errorf("%s.rejectedWhen requires receiptWhen or receiptIdentity", owner)
	}
	return validateConditionTree(command.RejectedWhen, owner+".rejectedWhen", validateReceiptLeaf)
}

func validateReceiptLeaf(leaf map[string]any, at string) error {
	if source, ok := leaf["source"].(string); !ok || source != "collection" {
		return fmt.Errorf("%s must use collection scope for the invocation receipt", at)
	}
	selectors, operators, bounds := 0, 0, 0
	for key, operand := range leaf {
		switch key {
		case "source":
			continue
		case "field", "selector", "key":
			selector, _ := operand.(string)
			index, _, _ := strings.Cut(selector, ".")
			n, err := strconv.ParseUint(index, 10, 32)
			if err != nil || strconv.FormatUint(n, 10) != index || !validResourceSelector(selector) {
				return fmt.Errorf("%s.%s requires a row index and an optional dotted path in the invocation receipt", at, key)
			}
			selectors++
			continue
		case "contains":
			if !invariantScalar(operand) {
				return fmt.Errorf("%s.contains requires a scalar operand", at)
			}
		case "matches":
			if _, ok := operand.(string); !ok {
				return fmt.Errorf("%s.matches requires a string pattern", at)
			}
		default:
			bound, err := validateConditionOperand(key, operand, at)
			if err != nil {
				return err
			}
			if bound {
				bounds++
			}
		}
		operators++
	}
	if selectors != 1 || (operators > 1 && bounds != operators) {
		return fmt.Errorf("%s requires one receipt selector and either one predicate or numeric bounds", at)
	}
	return nil
}
