package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider"
	"github.com/viant/forge/backend/types"
	"testing"
	"time"
)

func TestLogicalDatasourceUpdateDoesNotRequireConsumerRepublish(t *testing.T) {
	stack := newDependencyStack(t, time.Now().Add(time.Minute))
	// Change the selected producer definition after the original operation ended.
	// The owning window has not changed and a new OPEN authorizes the new source.
	stack.child.raw = json.RawMessage(`{"schemaVersion":1,"dataSource":{"id":"source-authored-id","backend":{"kind":"inline","rows":[{"orderId":2,"newField":"available"}]},"selectors":{"data":"data"}}}`)
	opened, err := stack.catalog.Get(context.Background(), &primitive.WindowDefinitionGetInput{WindowID: stack.parentURI})
	require.NoError(t, err)
	require.NotNil(t, opened.Definition)
	var envelope types.WindowResourceEnvelope
	require.NoError(t, json.Unmarshal(stack.parent.raw, &envelope))
	require.NotEmpty(t, envelope.Variants, "consumer definition remains unchanged")
}
