package uicontext

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/viant/forge/backend/types"
	"strings"
	"testing"
	"time"
)

func TestLocalStateOwnerAttachmentStripsAuthoredAndValidatesTrustedScope(t *testing.T) {
	w := &types.Window{LocalStateOwner: &types.LocalStateOwner{Binding: "AUTHORED", ValidUntil: time.Now().Add(time.Hour)}}
	copy, err := AttachLocalStateOwner(context.Background(), w, nil)
	if err != nil || copy.LocalStateOwner != nil || w.LocalStateOwner.Binding != "AUTHORED" {
		t.Fatal("untrusted owner retained or input mutated")
	}
	for _, owner := range []*types.LocalStateOwner{nil, {Binding: "expired", ValidUntil: time.Now().Add(-time.Second)}, {Binding: "", ValidUntil: time.Now().Add(time.Hour)}} {
		copy, err = AttachLocalStateOwner(context.Background(), w, func(context.Context) (*types.LocalStateOwner, error) { return owner, nil })
		if err != nil || copy.LocalStateOwner != nil {
			t.Fatal("invalid owner retained")
		}
	}
	owner := &types.LocalStateOwner{Binding: "PRIVATE_OWNER", ValidUntil: time.Now().Add(time.Minute)}
	copy, err = AttachLocalStateOwner(context.Background(), w, func(context.Context) (*types.LocalStateOwner, error) { return owner, nil })
	if err != nil || copy.LocalStateOwner.Binding != owner.Binding {
		t.Fatal("trusted owner not attached")
	}
	owner.Binding = "MUTATED"
	if copy.LocalStateOwner.Binding != "PRIVATE_OWNER" {
		t.Fatal("callback alias retained")
	}
	raw, _ := json.Marshal(copy)
	read, err := RedactReadJSON(raw, ReadOptions{})
	if err != nil || strings.Contains(string(read.JSON), "PRIVATE_OWNER") {
		t.Fatal("read exposed owner")
	}
	_, err = AttachLocalStateOwner(context.Background(), w, func(context.Context) (*types.LocalStateOwner, error) { return nil, errors.New("denied") })
	if err == nil {
		t.Fatal("callback failure accepted")
	}
}
