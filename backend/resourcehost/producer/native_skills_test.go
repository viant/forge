package provider

import (
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	skillformat "github.com/viant/mcp-protocol/extension/skills"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
)

func TestNativeSkillPublisherWireCapabilityPagesAndOwnerScope(t *testing.T) {
	for _, count := range []int{0, 33} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			captured := []*skillformat.Static{}
			for i := 0; i < count; i++ {
				name := fmt.Sprintf("review%02d", i)
				document := []byte("---\nname: " + name + "\ndescription: Original instruction\n---\nCaptured document.")
				compiled, err := (skillformat.Compiler{Source: fstest.MapFS{"SKILL.md": {Data: document}, "refs/note.txt": {Data: []byte("Captured supporting bytes")}}}).Compile(context.Background(), "skill://workspace/"+name+"/SKILL.md")
				require.NoError(t, err)
				captured = append(captured, compiled)
			}
			expiry := time.Now().Add(time.Hour)
			actor := func(ctx context.Context) (identity.VerifiedActor, error) {
				subject := authctx.EffectiveUserID(ctx)
				if subject == "" {
					return identity.VerifiedActor{}, identity.ErrResourceDenied
				}
				return identity.VerifiedActor{Subject: subject, Issuer: "wire-test", TenantID: "test", AccountID: "test", IdentityRevision: "one", ValidUntil: expiry}, nil
			}
			provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "native-skills", NativeSkills: captured, Actor: actor, Verify: func(ctx context.Context, held identity.VerifiedActor) error {
				if held.Subject != authctx.EffectiveUserID(ctx) {
					return identity.ErrResourceDenied
				}
				return nil
			}, Authorize: func(_ context.Context, a identity.VerifiedActor, _ identity.ResourceURI, _ string) error {
				if a.Subject != "alice" {
					return identity.ErrResourceDenied
				}
				return nil
			}})
			require.NoError(t, err)
			handler, err := NewLocalMCPHandler(provider, func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					subject := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
					ctx := r.Context()
					if subject == "alice" || subject == "bob" {
						ctx = authctx.WithUserInfo(ctx, &authctx.UserInfo{Subject: subject})
					}
					next.ServeHTTP(w, r.WithContext(ctx))
				})
			})
			require.NoError(t, err)
			server := httptest.NewServer(handler)
			defer server.Close()
			cli, err := mcp.NewClientWithContext(context.Background(), nil, &mcp.ClientOptions{Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}})
			require.NoError(t, err)
			alice := []mcpclient.RequestOption{mcpclient.WithAuthToken("alice")}
			initialized, err := cli.Initialize(context.Background(), alice...)
			require.NoError(t, err)
			require.Contains(t, initialized.Capabilities.Extensions, schema.SkillsExtension)
			require.NotNil(t, initialized.Capabilities.Resources)
			native := cli
			page, err := native.ListSkills(context.Background(), nil, alice...)
			require.NoError(t, err)
			require.Equal(t, schema.ResultTypeComplete, page.ResultType)
			require.Len(t, page.Skills, min(count, 32))
			if count > 32 {
				require.NotNil(t, page.NextCursor)
				last, e := native.ListSkills(context.Background(), page.NextCursor, alice...)
				require.NoError(t, e)
				require.Len(t, last.Skills, 1)
				require.Nil(t, last.NextCursor)
			}
			tools, err := cli.ListTools(context.Background(), nil, alice...)
			require.NoError(t, err)
			for _, tool := range tools.Tools {
				require.NotEqual(t, schema.MethodSkillsList, tool.Name)
				require.NotEqual(t, schema.MethodSkillsGet, tool.Name)
			}
			empty, err := native.ListSkills(context.Background(), nil, mcpclient.WithAuthToken("bob"))
			require.NoError(t, err)
			require.Empty(t, empty.Skills)
			hiddenResources, e := cli.ListResources(context.Background(), nil, mcpclient.WithAuthToken("bob"))
			require.NoError(t, e)
			require.Empty(t, hiddenResources.Resources)
			_, err = native.ListSkills(context.Background(), nil)
			require.Error(t, err, "anonymous transport cannot borrow prior authenticated request")
			if count == 0 {
				return
			}
			entry := page.Skills[0]
			got, err := native.GetSkill(context.Background(), entry.Uri, alice...)
			require.NoError(t, err)
			require.Equal(t, entry, got.Skill)
			require.Len(t, got.Skill.Resources.Files, 2)
			for _, file := range got.Skill.Resources.Files {
				read, e := cli.ReadResource(context.Background(), &schema.ReadResourceRequestParams{Uri: file.Uri}, alice...)
				require.NoError(t, e)
				require.Len(t, read.Contents, 1)
				data := []byte(read.Contents[0].Text)
				require.Equal(t, file.Size, int64(len(data)))
				require.Equal(t, file.Digest, fmt.Sprintf("sha256:%x", sha256.Sum256(data)))
			}
			_, err = native.GetSkill(context.Background(), entry.Uri, mcpclient.WithAuthToken("bob"))
			require.Error(t, err)
			_, err = cli.ReadResource(context.Background(), &schema.ReadResourceRequestParams{Uri: entry.Uri}, mcpclient.WithAuthToken("bob"))
			require.Error(t, err)
		})
	}
}
