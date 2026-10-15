// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/viant/afs"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
)

type fixtureMetadataScope struct {
	begins, finishes int
	bypasses         int
	finishErr        error
}

func (s *fixtureMetadataScope) BeginMetadataRead(ctx context.Context) (context.Context, func() error, error) {
	s.begins++
	return ctx, func() error {
		s.finishes++
		return s.finishErr
	}, nil
}
func (s *fixtureMetadataScope) WithoutMetadataRead(ctx context.Context) context.Context {
	s.bypasses++
	return ctx
}

func fixtureWindowCatalog(t *testing.T, scope MetadataReadScope) *MetadataWindowCatalog {
	t.Helper()
	loader := meta.New(afs.New(), t.TempDir())
	catalog, err := NewMetadataWindowCatalog(loader, filepath.Clean("."), []SavedWindow{{
		WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "overview", Title: "Overview"}, Key: "overview",
	}}, WithWindowMetadataScope(scope), WithWindowDefinitionLoader(func(context.Context, string) (*types.Window, error) {
		return &types.Window{WindowKey: "overview", View: types.View{Content: &types.Container{ID: "root"}}}, nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	return catalog
}

func TestWindowMetadataScopeFinalizesCatalogReadsAndBuffersFailures(t *testing.T) {
	scope := &fixtureMetadataScope{}
	catalog := fixtureWindowCatalog(t, scope)
	page, err := catalog.List(context.Background(), &WindowDefinitionListInput{Limit: 10})
	if err != nil || page == nil || len(page.Windows) != 1 || scope.begins != 1 || scope.finishes != 1 {
		t.Fatalf("list=%+v begins=%d finishes=%d err=%v", page, scope.begins, scope.finishes, err)
	}
	definition, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "overview"})
	if err != nil || definition == nil || definition.Definition == nil || scope.begins != 2 || scope.finishes != 2 {
		t.Fatalf("get=%+v begins=%d finishes=%d err=%v", definition, scope.begins, scope.finishes, err)
	}
	scope.finishErr = errors.New("authority revision changed")
	page, err = catalog.List(context.Background(), &WindowDefinitionListInput{Limit: 10})
	if err == nil || page != nil || scope.begins != 3 || scope.finishes != 3 {
		t.Fatalf("failed finalization leaked list=%+v begins=%d finishes=%d err=%v", page, scope.begins, scope.finishes, err)
	}
	definition, err = catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "overview"})
	if err == nil || definition != nil || scope.begins != 4 || scope.finishes != 4 {
		t.Fatalf("failed finalization leaked get=%+v begins=%d finishes=%d err=%v", definition, scope.begins, scope.finishes, err)
	}
}

func TestNestedForgeMetadataReadsLeaveFinishToOutermostScope(t *testing.T) {
	scope := &fixtureMetadataScope{}
	catalog := fixtureWindowCatalog(t, scope)
	ctx, finish, err := BeginMetadataReadScope(context.Background(), scope)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := catalog.List(ctx, &WindowDefinitionListInput{}); err != nil {
		t.Fatal(err)
	}
	if _, err := catalog.Get(ctx, &WindowDefinitionGetInput{WindowID: "overview"}); err != nil {
		t.Fatal(err)
	}
	if scope.begins != 1 || scope.finishes != 0 {
		t.Fatalf("nested calls began/finalized scopes early: begins=%d finishes=%d", scope.begins, scope.finishes)
	}
	if err := FinishMetadataReadScope(finish, nil); err != nil || scope.finishes != 1 {
		t.Fatalf("outer finish count=%d err=%v", scope.finishes, err)
	}
}

func TestMetadataScopeRequiresFinalizerAndDoesNotMergeDifferentScopes(t *testing.T) {
	missing := missingMetadataFinalizerScope{}
	if _, _, err := BeginMetadataReadScope(context.Background(), missing); err == nil {
		t.Fatal("configured scope without a finalizer was accepted")
	}
	outer, inner := &fixtureMetadataScope{}, &fixtureMetadataScope{}
	ctx, finishOuter, err := BeginMetadataReadScope(context.Background(), outer)
	if err != nil {
		t.Fatal(err)
	}
	nested, finishInner, err := BeginMetadataReadScope(ctx, inner)
	if err != nil || nested == nil || outer.begins != 1 || inner.begins != 1 {
		t.Fatalf("different nested scope was skipped: outer=%d inner=%d err=%v", outer.begins, inner.begins, err)
	}
	if err := FinishMetadataReadScope(finishInner, nil); err != nil {
		t.Fatal(err)
	}
	if err := FinishMetadataReadScope(finishOuter, nil); err != nil || outer.finishes != 1 || inner.finishes != 1 {
		t.Fatalf("scope finalization outer=%d inner=%d err=%v", outer.finishes, inner.finishes, err)
	}
	bypassCtx := WithoutMetadataReadScope(context.Background(), outer)
	if bypassCtx == nil || outer.bypasses != 1 {
		t.Fatalf("explicit scope bypass was not called: context=%v bypasses=%d", bypassCtx, outer.bypasses)
	}
}

type missingMetadataFinalizerScope struct{}

func (missingMetadataFinalizerScope) BeginMetadataRead(ctx context.Context) (context.Context, func() error, error) {
	return ctx, nil, nil
}
func (missingMetadataFinalizerScope) WithoutMetadataRead(ctx context.Context) context.Context {
	return ctx
}

func TestForgeConfigMetadataScopeWrapsPublicServiceMethods(t *testing.T) {
	scope := &fixtureMetadataScope{}
	service := NewService(&Config{WindowDefinitions: fixtureWindowCatalog(t, nil), MetadataScope: scope})
	page, err := service.WindowDefinitionsList(context.Background(), &WindowDefinitionListInput{Limit: 10})
	if err != nil || page == nil || len(page.Windows) != 1 || scope.begins != 1 || scope.finishes != 1 {
		t.Fatalf("service list=%+v scopes=%d/%d err=%v", page, scope.begins, scope.finishes, err)
	}
	definition, err := service.WindowDefinitionGet(context.Background(), &WindowDefinitionGetInput{WindowID: "overview"})
	if err != nil || definition == nil || definition.Definition == nil || scope.begins != 2 || scope.finishes != 2 {
		t.Fatalf("service get=%+v scopes=%d/%d err=%v", definition, scope.begins, scope.finishes, err)
	}
}

func TestWindowOpenDefinitionLoadDoesNotBeginMetadataScope(t *testing.T) {
	scope := &fixtureMetadataScope{}
	catalog := fixtureWindowCatalog(t, scope)
	if _, err := catalog.GetForOpen(context.Background(), &WindowDefinitionGetInput{WindowID: "overview"}); err != nil {
		t.Fatal(err)
	}
	if scope.begins != 0 || scope.finishes != 0 {
		t.Fatalf("open definition load began a metadata scope: begins=%d finishes=%d", scope.begins, scope.finishes)
	}
}

func TestWindowMetadataScopeFinalizesAfterReadError(t *testing.T) {
	scope := &fixtureMetadataScope{}
	loader := meta.New(afs.New(), t.TempDir())
	catalog, err := NewMetadataWindowCatalog(loader, filepath.Clean("."), []SavedWindow{{
		WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "overview", Title: "Overview"}, Key: "overview",
	}}, WithWindowMetadataScope(scope), WithWindowDefinitionLoader(func(context.Context, string) (*types.Window, error) {
		return nil, errors.New("definition read failed")
	}))
	if err != nil {
		t.Fatal(err)
	}
	result, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "overview"})
	if err == nil || result != nil || scope.begins != 1 || scope.finishes != 1 {
		t.Fatalf("read failure result=%+v scopes=%d/%d err=%v", result, scope.begins, scope.finishes, err)
	}
}
