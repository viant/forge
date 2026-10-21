package uimetadata

import (
	"encoding/json"
	"github.com/viant/forge/backend/types"
	"strings"
	"testing"
	"time"
)

func TestMetadataOmitsPrivateLocalStateOwner(t *testing.T) {
	w := definition(t, `{"windowKey":"record","view":{"content":{"id":"editor","items":[{"id":"name","type":"text","dataField":"name"}]}}}`)
	w.LocalStateOwner = &types.LocalStateOwner{Binding: "PRIVATE_LOCAL_OWNER", ValidUntil: time.Now().Add(time.Minute)}
	page, err := Project(w, Query{})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(page)
	if err != nil || strings.Contains(string(raw), "PRIVATE_LOCAL_OWNER") || strings.Contains(string(raw), "localStateOwner") {
		t.Fatal("metadata exposed lifecycle owner")
	}
}
