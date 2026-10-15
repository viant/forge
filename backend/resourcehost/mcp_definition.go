package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"path"
	"strings"

	identity "github.com/viant/forge/backend/resource"
	mcpcfg "github.com/viant/mcp/client/config"
	"github.com/viant/scy/kms"
	"gopkg.in/yaml.v3"
)

// MCPDirectory publishes existing Agently MCP client YAML as authored metadata.
// Secret references remain references; loaders never initialize a connection.
func MCPDirectory(namespace, directory string) ExtensionDirectory {
	return ExtensionDirectory{Kind: "mcp", Namespace: namespace, Directory: directory, FormatVersion: 1, Suffixes: []string{".yaml", ".yml"}, Load: NativeMCPLoader}
}

func NativeMCPLoader(ctx context.Context, reader *ExtensionReader, file string) (json.RawMessage, error) {
	raw, err := reader.ReadFile(ctx, file)
	if err != nil {
		return nil, err
	}
	var fields any
	if err = yaml.Unmarshal(raw, &fields); err != nil {
		return nil, fmt.Errorf("invalid MCP definition YAML")
	}
	if err = rejectMCPCredentials(fields); err != nil {
		return nil, err
	}
	var config mcpcfg.MCPClient
	decoder := yaml.NewDecoder(bytes.NewReader(raw))
	decoder.KnownFields(true)
	if err = decoder.Decode(&config); err != nil {
		return nil, fmt.Errorf("invalid MCP definition fields")
	}
	if decoder.Decode(new(any)) != io.EOF {
		return nil, fmt.Errorf("MCP definition must be one YAML document")
	}
	if config.ClientOptions != nil && config.Name == "" {
		config.Name = strings.TrimSuffix(path.Base(file), path.Ext(file))
	}
	encoded, err := json.Marshal(&config)
	if err != nil {
		return nil, err
	}
	if err = ValidateMCPDefinition(1, encoded); err != nil {
		return nil, err
	}
	return encoded, nil
}

func DecodeMCPDefinition(version int64, raw json.RawMessage) (*mcpcfg.MCPClient, error) {
	if version != 1 {
		return nil, identity.ErrResource
	}
	var fields any
	if json.Unmarshal(raw, &fields) != nil {
		return nil, fmt.Errorf("invalid MCP definition JSON")
	}
	if err := rejectMCPCredentials(fields); err != nil {
		return nil, err
	}
	var config mcpcfg.MCPClient
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&config) != nil || decoder.Decode(new(any)) != io.EOF {
		return nil, fmt.Errorf("invalid MCP definition fields")
	}
	if config.ClientOptions == nil || strings.TrimSpace(config.Name) == "" {
		return nil, fmt.Errorf("MCP definition requires client settings and name")
	}
	if auth := config.Auth; auth != nil {
		if auth.EncryptionKey != "" {
			key, err := kms.NewKey(auth.EncryptionKey)
			if err != nil || key.Kind == "raw" || key.Kind == "inline" {
				return nil, fmt.Errorf("MCP encryption key must be a valid key reference")
			}
		}
		for _, ref := range auth.OAuth2ConfigURL {
			if err := validateMCPSecretReference(ref); err != nil {
				return nil, err
			}
		}
		if auth.InlineProvider != nil {
			if err := auth.InlineProvider.Validate(); err != nil {
				return nil, fmt.Errorf("invalid MCP OAuth provider configuration")
			}
			for _, client := range auth.InlineProvider.Clients {
				if client != nil && client.ConfigURL != "" {
					if err := validateMCPSecretReference(client.ConfigURL); err != nil {
						return nil, err
					}
				}
			}
		}
	}
	return &config, nil
}
func ValidateMCPDefinition(version int64, raw json.RawMessage) error {
	_, err := DecodeMCPDefinition(version, raw)
	return err
}

// MCPDefinitionYAML serializes the same client model used by workspace loading.
// Runtime resolver/store/transport state is excluded by the existing model tags.
func MCPDefinitionYAML(version int64, raw json.RawMessage) ([]byte, error) {
	config, err := DecodeMCPDefinition(version, raw)
	if err != nil {
		return nil, err
	}
	return yaml.Marshal(config)
}

func rejectMCPURLCredentials(value string) error {
	parsed, err := url.Parse(value)
	if err != nil {
		return nil
	}
	if parsed.User != nil {
		return fmt.Errorf("MCP URL must not contain inline credentials")
	}
	for key := range parsed.Query() {
		switch strings.ToLower(strings.ReplaceAll(key, "_", "")) {
		case "token", "accesstoken", "refreshtoken", "idtoken", "clientsecret", "password":
			return fmt.Errorf("MCP URL must not contain inline credentials")
		}
	}
	return nil
}

func validateMCPSecretReference(value string) error {
	if err := rejectMCPURLCredentials(value); err != nil {
		return err
	}
	if strings.TrimSpace(value) == "" || strings.HasPrefix(strings.ToLower(value), "inlined:") || strings.HasPrefix(strings.ToLower(value), "data:") {
		return fmt.Errorf("MCP OAuth configuration must use a secret resource reference")
	}
	if _, key, ok := strings.Cut(value, "|"); ok {
		parsed, err := kms.NewKey(key)
		if err != nil || parsed.Kind == "raw" || parsed.Kind == "inline" {
			return fmt.Errorf("MCP OAuth encryption key must be a valid key reference")
		}
	}
	return nil
}
func rejectMCPCredentials(value any) error {
	switch current := value.(type) {
	case map[string]any:
		for key, child := range current {
			normalized := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(key, "_", ""), "-", ""))
			switch normalized {
			case "clients", "descriptions", "cacheable", "resourcecachescopes", "outputartifacts":
				if names, ok := child.(map[string]any); ok {
					for _, entry := range names {
						if err := rejectMCPCredentials(entry); err != nil {
							return err
						}
					}
					continue
				}
			case "accesstoken", "refreshtoken", "idtoken", "clientsecret", "password", "token":
				return fmt.Errorf("MCP definition contains literal credential field %q", key)
			}
			if strings.HasSuffix(normalized, "url") || normalized == "issuer" || normalized == "resource" {
				if value, ok := child.(string); ok {
					if err := rejectMCPURLCredentials(value); err != nil {
						return err
					}
				}
			}
			if normalized == "encryptionkey" || normalized == "secretkey" {
				if value, ok := child.(string); ok && value != "" {
					key, err := kms.NewKey(value)
					if err != nil || key.Kind == "raw" || key.Kind == "inline" {
						return fmt.Errorf("MCP encryption key must be a valid key reference")
					}
				}
			}
			if normalized == "secret" {
				if ref, ok := child.(string); ok {
					if err := validateMCPSecretReference(ref); err != nil {
						return err
					}
				} else if ref, ok := child.(map[string]any); ok {
					var location string
					for field, value := range ref {
						switch strings.ToLower(field) {
						case "url", "uri":
							location, _ = value.(string)
						case "data":
							return fmt.Errorf("MCP secret resource must not contain inline data")
						case "key":
							key, _ := value.(string)
							if key != "" {
								parsed, err := kms.NewKey(key)
								if err != nil || parsed.Kind == "raw" || parsed.Kind == "inline" {
									return fmt.Errorf("MCP secret resource key must be a reference")
								}
							}
						}
					}
					if err := validateMCPSecretReference(location); err != nil {
						return err
					}
				} else {
					return fmt.Errorf("MCP secret resource must be a reference")
				}
			}
			if normalized == "authorization" {
				if _, ok := child.(string); ok {
					return fmt.Errorf("MCP definition must not contain an authorization credential")
				}
			}
			if err := rejectMCPCredentials(child); err != nil {
				return err
			}
		}
	case []any:
		for _, child := range current {
			if err := rejectMCPCredentials(child); err != nil {
				return err
			}
		}
	}
	return nil
}
