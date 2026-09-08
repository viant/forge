package types

import (
	"fmt"
	"strings"
)

// ValidateResourceModelStructure validates contracts that do not depend on the
// effective datasource registry. Hosts that merge datasource assets later use
// this during initial window loading, then call ValidateResourceModels once.
func ValidateResourceModelStructure(window *Window) error {
	return validateResourceModels(window, false)
}

// ValidateResourceModels validates the complete effective window, including
// datasource symmetry, before it reaches any renderer.
func ValidateResourceModels(window *Window) error {
	return validateResourceModels(window, true)
}

func validateResourceModels(window *Window, validateDataSources bool) error {
	if window == nil {
		return nil
	}
	for name, schema := range window.Schemas {
		if strings.TrimSpace(name) == "" {
			return fmt.Errorf("resource schema name is required")
		}
		if strings.ToLower(schema.Type) != "object" {
			return fmt.Errorf("resource schema %s must be an object", name)
		}
		for _, field := range append(append([]string{}, schema.Identity...), schema.Required...) {
			if _, ok := schema.Properties[field]; !ok {
				return fmt.Errorf("resource schema %s references undeclared field %s", name, field)
			}
		}
		for field, property := range schema.Properties {
			if err := validateResourceFieldSchema(window.Schemas, name+"."+field, property); err != nil {
				return err
			}
		}
	}
	for name, model := range window.ResourceModels {
		schema, ok := window.Schemas[model.SchemaRef]
		if !ok {
			return fmt.Errorf("resource model %s references unknown schema %s", name, model.SchemaRef)
		}
		for field, binding := range model.Fields {
			fieldSchema, ok := schema.Properties[field]
			if !ok {
				return fmt.Errorf("resource model %s binds undeclared field %s", name, field)
			}
			if err := validateResourceFieldBinding(window, name, field, fieldSchema, binding); err != nil {
				return err
			}
		}
		mode := normalizedResourceMode(model.Write)
		if mode != "" && mode != "full" && mode != "overlaybaseline" && mode != "changed" {
			return fmt.Errorf("resource model %s has unsupported write mode %s", name, model.Write.Mode)
		}
		if model.Write != nil && (mode == "" || mode == "changed") {
			for _, identity := range schema.Identity {
				if binding, ok := model.Fields[identity]; ok && binding.Write == "-" {
					return fmt.Errorf("resource model %s changed writer cannot omit identity field %s", name, identity)
				}
			}
		}
		if model.Write != nil && model.Write.Collection && strings.TrimSpace(model.Write.InputPath) == "" {
			return fmt.Errorf("resource model %s collection writer requires inputPath", name)
		}
		for _, ref := range []string{dataSourceRef(model.Read), writeDataSourceRef(model.Write)} {
			if ref != "" && validateDataSources {
				if _, ok := window.DataSource[ref]; !ok {
					return fmt.Errorf("resource model %s references unknown datasource %s", name, ref)
				}
			}
		}
	}
	for name, dataSource := range window.DataSource {
		if dataSource.ResourceModelRef == "" {
			continue
		}
		if _, ok := window.ResourceModels[dataSource.ResourceModelRef]; !ok {
			return fmt.Errorf("datasource %s references unknown resource model %s", name, dataSource.ResourceModelRef)
		}
		if validateDataSources {
			declared := dataSourceRef(window.ResourceModels[dataSource.ResourceModelRef].Read)
			if declared != "" && declared != name {
				return fmt.Errorf("datasource %s cannot use resource model %s declared for reader %s", name, dataSource.ResourceModelRef, declared)
			}
		}
	}
	if err := validateContainerResourceModels(window, window.View.Content, validateDataSources); err != nil {
		return err
	}
	for index := range window.Dialogs {
		if err := validateContainerResourceModels(window, window.Dialogs[index].Content, validateDataSources); err != nil {
			return fmt.Errorf("dialog %s: %w", window.Dialogs[index].Id, err)
		}
	}
	return nil
}

func validateResourceFieldSchema(schemas map[string]ResourceSchema, path string, field ResourceFieldSchema) error {
	typeName := strings.ToLower(strings.TrimSpace(field.Type))
	if typeName != "" && typeName != "object" && typeName != "array" && typeName != "string" && typeName != "integer" && typeName != "number" && typeName != "boolean" {
		return fmt.Errorf("resource field %s has unsupported type %s", path, field.Type)
	}
	if field.Ref != "" {
		if _, ok := schemas[field.Ref]; !ok {
			return fmt.Errorf("resource field %s references unknown schema %s", path, field.Ref)
		}
		if typeName != "" || field.Items != nil || len(field.Properties) > 0 {
			return fmt.Errorf("resource field %s cannot combine $ref with an inline shape", path)
		}
	}
	if field.Minimum != nil && field.Maximum != nil && *field.Minimum > *field.Maximum {
		return fmt.Errorf("resource field %s has minimum greater than maximum", path)
	}
	if (field.Minimum != nil || field.Maximum != nil) && typeName != "integer" && typeName != "number" {
		return fmt.Errorf("resource field %s declares numeric bounds without a numeric type", path)
	}
	if (field.MinLength != nil || field.MaxLength != nil) && typeName != "string" {
		return fmt.Errorf("resource field %s declares length bounds without type string", path)
	}
	if (field.MinItems != nil || field.MaxItems != nil) && typeName != "array" {
		return fmt.Errorf("resource field %s declares item bounds without type array", path)
	}
	for _, bound := range []*int{field.MinLength, field.MaxLength, field.MinItems, field.MaxItems} {
		if bound != nil && *bound < 0 {
			return fmt.Errorf("resource field %s has a negative size bound", path)
		}
	}
	if field.MinLength != nil && field.MaxLength != nil && *field.MinLength > *field.MaxLength {
		return fmt.Errorf("resource field %s has minLength greater than maxLength", path)
	}
	if field.MinItems != nil && field.MaxItems != nil && *field.MinItems > *field.MaxItems {
		return fmt.Errorf("resource field %s has minItems greater than maxItems", path)
	}
	if field.Items != nil && typeName != "array" {
		return fmt.Errorf("resource field %s declares items without type array", path)
	}
	if len(field.Properties) > 0 && typeName != "object" {
		return fmt.Errorf("resource field %s declares properties without type object", path)
	}
	for _, required := range field.Required {
		if _, ok := field.Properties[required]; !ok {
			return fmt.Errorf("resource field %s requires undeclared field %s", path, required)
		}
	}
	if field.Items != nil {
		if err := validateResourceFieldSchema(schemas, path+"[]", *field.Items); err != nil {
			return err
		}
	}
	for name, nested := range field.Properties {
		if err := validateResourceFieldSchema(schemas, path+"."+name, nested); err != nil {
			return err
		}
	}
	return nil
}

func validateResourceFieldBinding(window *Window, modelName, fieldName string, fieldSchema ResourceFieldSchema, binding ResourceFieldBinding) error {
	path := modelName + "." + fieldName
	codec := strings.ToLower(strings.TrimSpace(binding.Codec))
	if codec != "" && codec != "int" && codec != "integer" && codec != "float" && codec != "number" && codec != "bool" && codec != "boolean" && codec != "string" {
		return fmt.Errorf("resource model field %s has unsupported codec %s", path, binding.Codec)
	}
	if binding.Trim && codec != "string" && strings.ToLower(fieldSchema.Type) != "string" {
		return fmt.Errorf("resource model field %s can trim only strings", path)
	}
	if binding.ModelRef != "" && binding.Collection != nil {
		return fmt.Errorf("resource model field %s cannot declare both modelRef and collection", path)
	}
	ref := binding.ModelRef
	if binding.Collection != nil {
		if strings.ToLower(fieldSchema.Type) != "array" {
			return fmt.Errorf("resource model collection %s requires schema type array", path)
		}
		ref = binding.Collection.ModelRef
		mode := strings.ToLower(strings.TrimSpace(binding.Collection.Mode))
		if mode != "" && mode != "replace" && mode != "merge" {
			return fmt.Errorf("resource model field %s has unsupported collection mode %s", path, binding.Collection.Mode)
		}
	}
	if ref == "" {
		return nil
	}
	nested, ok := window.ResourceModels[ref]
	if !ok {
		return fmt.Errorf("resource model field %s references unknown model %s", path, ref)
	}
	nestedSchema, ok := window.Schemas[nested.SchemaRef]
	if !ok {
		return fmt.Errorf("resource model field %s references model %s with unknown schema %s", path, ref, nested.SchemaRef)
	}
	if binding.Collection != nil {
		if fieldSchema.Items != nil && fieldSchema.Items.Ref != "" && fieldSchema.Items.Ref != nested.SchemaRef {
			return fmt.Errorf("resource model collection %s model schema %s does not match item schema %s", path, nested.SchemaRef, fieldSchema.Items.Ref)
		}
		identities := binding.Collection.Identity
		if len(identities) == 0 {
			identities = nestedSchema.Identity
		}
		if len(identities) == 0 {
			return fmt.Errorf("resource model collection %s requires identity fields", path)
		}
		for _, identity := range identities {
			if _, ok := nestedSchema.Properties[identity]; !ok {
				return fmt.Errorf("resource model collection %s references undeclared identity %s", path, identity)
			}
		}
		if clientKey := strings.TrimSpace(binding.Collection.ClientKey); clientKey != "" {
			if _, ok := nestedSchema.Properties[clientKey]; !ok {
				return fmt.Errorf("resource model collection %s references undeclared clientKey %s", path, clientKey)
			}
		}
	} else if fieldSchema.Ref != "" && fieldSchema.Ref != nested.SchemaRef {
		return fmt.Errorf("resource model field %s model schema %s does not match field schema %s", path, nested.SchemaRef, fieldSchema.Ref)
	}
	return nil
}

func validateContainerResourceModels(window *Window, container *Container, validateDataSources bool) error {
	if container == nil {
		return nil
	}
	commands := []*MutationCommand{container.MutationCommand}
	if container.EditableCollection != nil {
		commands = append(commands, container.EditableCollection.Mutation)
		for index := range container.EditableCollection.Operations {
			commands = append(commands, container.EditableCollection.Operations[index].Mutation)
		}
	}
	if container.AssignmentPicker != nil {
		commands = append(commands, container.AssignmentPicker.Assign, container.AssignmentPicker.Unassign)
	}
	if container.StatusWorkflow != nil {
		for index := range container.StatusWorkflow.Transitions {
			commands = append(commands, container.StatusWorkflow.Transitions[index].Command)
		}
	}
	if container.TreeEditor != nil {
		commands = append(commands, container.TreeEditor.Mutation)
	}
	if container.Wizard != nil {
		commands = append(commands, container.Wizard.Submit)
	}
	if container.UploadCollection != nil {
		commands = append(commands, container.UploadCollection.Upload)
	}
	if container.ScheduleEditor != nil {
		commands = append(commands, container.ScheduleEditor.Mutation)
	}
	if container.DraftForm != nil {
		commands = append(commands, container.DraftForm.Submit)
	}
	if container.ResourceHeader != nil {
		for index := range container.ResourceHeader.Actions {
			commands = append(commands, container.ResourceHeader.Actions[index].Mutation)
		}
	}
	if container.NotificationRules != nil {
		for index := range container.NotificationRules.Rules {
			if action := container.NotificationRules.Rules[index].Action; action != nil {
				commands = append(commands, action.Mutation)
			}
		}
	}
	for _, command := range commands {
		if command == nil || command.Payload == nil {
			continue
		}
		model, ok := window.ResourceModels[command.Payload.ModelRef]
		if !ok {
			return fmt.Errorf("container %s command references unknown resource model %s", container.ID, command.Payload.ModelRef)
		}
		if err := validateResourcePayload(window, container.ID, command, model, validateDataSources); err != nil {
			return err
		}
	}
	for index := range container.Containers {
		if err := validateContainerResourceModels(window, &container.Containers[index], validateDataSources); err != nil {
			return err
		}
	}
	if err := validateContainerResourceModels(window, container.Footer, validateDataSources); err != nil {
		return err
	}
	return nil
}

func validateResourcePayload(window *Window, containerID string, command *MutationCommand, model ResourceModel, validateDataSources bool) error {
	payload := command.Payload
	mode := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(payload.Mode), "-", ""), "_", ""))
	if mode != "" && mode != "full" && mode != "overlaybaseline" && mode != "changed" {
		return fmt.Errorf("container %s command has unsupported payload mode %s", containerID, payload.Mode)
	}
	if model.Write == nil {
		return fmt.Errorf("container %s resource payload model requires a write binding", containerID)
	}
	effectiveMode := mode
	if effectiveMode == "" {
		effectiveMode = normalizedResourceMode(model.Write)
	}
	if effectiveMode == "" {
		effectiveMode = "changed"
	}
	if effectiveMode == "changed" {
		schema := window.Schemas[model.SchemaRef]
		for _, identity := range schema.Identity {
			if binding, ok := model.Fields[identity]; ok && binding.Write == "-" {
				return fmt.Errorf("container %s changed payload cannot omit identity field %s", containerID, identity)
			}
		}
	}
	if model.Write != nil {
		if declared := strings.TrimSpace(model.Write.DataSourceRef); declared != "" && declared != command.DataSourceRef {
			return fmt.Errorf("container %s command datasource %s does not match resource model writer %s", containerID, command.DataSourceRef, declared)
		}
		if target := strings.TrimSpace(payload.Target); target != "" && model.Write.InputPath != "" && target != model.Write.InputPath {
			return fmt.Errorf("container %s payload target %s does not match resource model inputPath %s", containerID, target, model.Write.InputPath)
		}
	}
	if validateDataSources {
		if _, ok := window.DataSource[command.DataSourceRef]; !ok {
			return fmt.Errorf("container %s command references unknown datasource %s", containerID, command.DataSourceRef)
		}
	}
	if strings.TrimSpace(payload.Target) == "" && (model.Write == nil || strings.TrimSpace(model.Write.InputPath) == "") {
		return fmt.Errorf("container %s resource payload requires a target or model inputPath", containerID)
	}
	if len(payload.Fields) > 0 {
		if resourceValueSourceConfigured(payload.Source) {
			return fmt.Errorf("container %s resource payload cannot combine source and fields", containerID)
		}
		for target, source := range payload.Fields {
			if strings.TrimSpace(target) == "" {
				return fmt.Errorf("container %s resource payload field target is required", containerID)
			}
			if err := validateResourceValueSource(window, containerID+" payload field "+target, source, validateDataSources, "extras"); err != nil {
				return err
			}
		}
	} else if err := validateResourceValueSource(window, containerID+" payload source", payload.Source, validateDataSources, "extras"); err != nil {
		return err
	}
	if payload.Baseline != nil {
		if err := validateResourceValueSource(window, containerID+" payload baseline", *payload.Baseline, validateDataSources, "collection"); err != nil {
			return err
		}
	} else if (mode == "overlaybaseline" || mode == "changed" || (mode == "" && normalizedResourceMode(model.Write) != "full")) && (model.Read == nil || model.Read.DataSourceRef == "") {
		return fmt.Errorf("container %s resource payload mode requires a baseline or model reader", containerID)
	}
	return nil
}

func validateResourceValueSource(window *Window, path string, source ResourceValueSource, validateDataSources bool, defaultScope string) error {
	scope := strings.ToLower(strings.TrimSpace(source.Scope))
	if scope == "" {
		scope = defaultScope
	}
	if scope != "constant" && scope != "extras" && scope != "form" && scope != "collection" && scope != "selection" && scope != "metrics" && scope != "input" && scope != "windowform" {
		return fmt.Errorf("%s has unsupported scope %s", path, source.Scope)
	}
	if source.DataSourceRef != "" && (scope == "constant" || scope == "extras" || scope == "windowform") {
		return fmt.Errorf("%s scope %s cannot declare dataSourceRef", path, scope)
	}
	if scope == "constant" && (source.Selector != "" || source.Where != nil || source.MapSelector != "") {
		return fmt.Errorf("%s constant scope cannot declare selector, where, or mapSelector", path)
	}
	codec := strings.ToLower(strings.TrimSpace(source.Codec))
	if codec != "" && codec != "int" && codec != "integer" && codec != "float" && codec != "number" && codec != "bool" && codec != "boolean" && codec != "string" {
		return fmt.Errorf("%s has unsupported codec %s", path, source.Codec)
	}
	if source.Where != nil {
		if strings.TrimSpace(source.Where.Field) == "" {
			return fmt.Errorf("%s where field is required", path)
		}
		comparisons := 0
		if source.Where.Equals != nil {
			comparisons++
		}
		if source.Where.NotEquals != nil {
			comparisons++
		}
		if len(source.Where.In) > 0 {
			comparisons++
		}
		if comparisons != 1 {
			return fmt.Errorf("%s where requires exactly one comparison", path)
		}
	}
	if validateDataSources && source.DataSourceRef != "" {
		if _, ok := window.DataSource[source.DataSourceRef]; !ok {
			return fmt.Errorf("%s references unknown datasource %s", path, source.DataSourceRef)
		}
	}
	return nil
}

func resourceValueSourceConfigured(source ResourceValueSource) bool {
	return strings.TrimSpace(source.Scope) != "" || strings.TrimSpace(source.DataSourceRef) != "" ||
		strings.TrimSpace(source.Selector) != "" || source.Value != nil || source.Where != nil ||
		strings.TrimSpace(source.MapSelector) != "" || strings.TrimSpace(source.Codec) != ""
}

func normalizedResourceMode(binding *ResourceWriteBinding) string {
	if binding == nil {
		return ""
	}
	return strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(binding.Mode), "-", ""), "_", ""))
}

func modelRef(binding *ResourceCollectionBinding) string {
	if binding == nil {
		return ""
	}
	return binding.ModelRef
}

func dataSourceRef(binding *ResourceReadBinding) string {
	if binding == nil {
		return ""
	}
	return binding.DataSourceRef
}

func writeDataSourceRef(binding *ResourceWriteBinding) string {
	if binding == nil {
		return ""
	}
	return binding.DataSourceRef
}
