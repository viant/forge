package resource

import (
	"context"

	"fmt"

	primitive "github.com/viant/forge/backend/provider/contract"

	schema "github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

type subsetProvider struct {
	*dependencyMCPProvider
	calls             map[string]int
	forbidden         []string
	listOnlyNamespace string
}

func (p *subsetProvider) CallTool(ctx context.Context, request *schema.CallToolRequestParams, options ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	listed, err := p.ListTools(ctx, nil)
	if err != nil {
		return nil, err
	}
	advertised := false
	for _, tool := range listed.Tools {
		if tool.Name == request.Name {
			advertised = true
			break
		}
	}
	if request.Name == "namespaces/get" && request.Arguments["namespace"] == "excluded" {
		p.forbidden = append(p.forbidden, "excluded namespace")
		return nil, fmt.Errorf("configured namespace exclusion was ignored")
	}
	if !advertised {
		p.forbidden = append(p.forbidden, request.Name)
		return nil, fmt.Errorf("unsupported subset tool %s", request.Name)
	}
	p.calls[request.Name]++
	result, err := p.dependencyMCPProvider.CallTool(ctx, request, options...)
	if err == nil && request.Name == "namespaces/get" {
		capabilities := result.StructuredContent.(primitive.NamespaceCapabilities)
		if capabilities.Namespace == p.listOnlyNamespace {
			for i := range capabilities.Kinds {
				capabilities.Kinds[i].Operations = []string{"list"}
				capabilities.Kinds[i].Methods = primitive.Methods(capabilities.Kinds[i].Kind, []string{"list"})
			}
			result.StructuredContent = capabilities
		}
	}
	return result, err
}

type ordinarySubsetSkills struct {
	mcpclient.Interface
	entry     schema.Skill
	body      string
	calls     map[string]int
	forbidden []string
}

func (p *ordinarySubsetSkills) ListResources(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	return &schema.ListResourcesResult{Resources: []schema.Resource{{Uri: p.entry.Uri, Name: p.entry.Uri}}}, nil
}

func (p *ordinarySubsetSkills) Initialize(context.Context, ...mcpclient.RequestOption) (*schema.InitializeResult, error) {
	return &schema.InitializeResult{ProtocolVersion: "2025-11-25", Capabilities: schema.ServerCapabilities{Resources: &schema.ServerCapabilitiesResources{}, Extensions: map[string]map[string]interface{}{schema.SkillsExtension: {}}}}, nil
}
func (p *ordinarySubsetSkills) ListTools(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	return &schema.ListToolsResult{Tools: []schema.Tool{}}, nil
}
func (p *ordinarySubsetSkills) ListSkills(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListSkillsResult, error) {
	p.calls["skills/list"]++
	return &schema.ListSkillsResult{ResultType: "complete", Skills: []schema.Skill{p.entry}}, nil
}
func (p *ordinarySubsetSkills) GetSkill(_ context.Context, uri string, _ ...mcpclient.RequestOption) (*schema.GetSkillResult, error) {
	p.calls["skills/get"]++
	if uri != p.entry.Uri {
		return nil, fmt.Errorf("unknown skill")
	}
	return &schema.GetSkillResult{ResultType: "complete", Skill: p.entry}, nil
}
func (p *ordinarySubsetSkills) CallTool(_ context.Context, request *schema.CallToolRequestParams, _ ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	p.forbidden = append(p.forbidden, request.Name)
	return nil, fmt.Errorf("unsupported ordinary tool")
}
func (p *ordinarySubsetSkills) ReadResource(_ context.Context, request *schema.ReadResourceRequestParams, _ ...mcpclient.RequestOption) (*schema.ReadResourceResult, error) {
	p.calls["resources/read"]++
	if request.Uri != p.entry.Uri {
		return nil, fmt.Errorf("unsupported skill resource")
	}
	return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{{Uri: request.Uri, Text: p.body}}}, nil
}
