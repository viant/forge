package service

import (
	"context"
	"errors"
	"github.com/viant/afs"
	"github.com/viant/forge/backend/service/meta"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type permissionProvider struct {
	authenticate func(context.Context) (WindowPrincipal, error)
	permissions  func(context.Context, WindowPrincipal) ([]string, error)
}

func (p permissionProvider) Authenticate(c context.Context) (WindowPrincipal, error) {
	return p.authenticate(c)
}
func (p permissionProvider) Permissions(c context.Context, k WindowPrincipal) ([]string, error) {
	return p.permissions(c, k)
}

func TestWindowPermissionCache(t *testing.T) {
	now := time.Now()
	key := WindowPrincipal{Issuer: "trusted", Subject: "alice", Tenant: "one"}
	authCalls, permissionCalls := 0, 0
	denyAuth, denyPermissions := false, false
	provider := permissionProvider{
		authenticate: func(context.Context) (WindowPrincipal, error) {
			authCalls++
			if denyAuth {
				return key, errors.New("expired")
			}
			return key, nil
		},
		permissions: func(context.Context, WindowPrincipal) ([]string, error) {
			permissionCalls++
			if denyPermissions {
				return nil, errors.New("unavailable")
			}
			return []string{"reader"}, nil
		},
	}
	resolve := newCachedWindowRoleResolver(provider, func() time.Time { return now })
	roles, err := resolve(context.Background())
	if err != nil || len(roles) != 1 {
		t.Fatal(roles, err)
	}
	roles[0] = "admin"
	roles, err = resolve(context.Background())
	if err != nil || roles[0] != "reader" || authCalls != 2 || permissionCalls != 1 {
		t.Fatal(roles, err, authCalls, permissionCalls)
	}
	denyAuth = true
	if _, err = resolve(context.Background()); err == nil {
		t.Fatal("cached permissions bypassed authentication")
	}
	denyAuth = false
	key.Tenant = "two"
	resolve(context.Background())
	if permissionCalls != 2 {
		t.Fatal("tenant cache collision")
	}
	key.Tenant = "one"
	now = now.Add(5 * time.Minute)
	denyPermissions = true
	for i := 0; i < 2; i++ {
		if _, err = resolve(context.Background()); err == nil {
			t.Fatal("provider error allowed access")
		}
	}
	if permissionCalls != 4 {
		t.Fatal("provider error cached", permissionCalls)
	}
	denyPermissions = false
	resolve(context.Background())
	if permissionCalls != 5 {
		t.Fatal("failed refresh retained stale grant")
	}
}

func TestWindowPermissionCacheConcurrent(t *testing.T) {
	var count atomic.Int32
	started, release := make(chan struct{}), make(chan struct{})
	resolve := NewCachedWindowRoleResolver(permissionProvider{
		authenticate: func(context.Context) (WindowPrincipal, error) {
			return WindowPrincipal{Issuer: "idp", Subject: "alice"}, nil
		},
		permissions: func(context.Context, WindowPrincipal) ([]string, error) {
			if count.Add(1) == 1 {
				close(started)
			}
			<-release
			return []string{"reader"}, nil
		},
	})
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			roles, err := resolve(context.Background())
			if err != nil || len(roles) != 1 {
				t.Error(roles, err)
			}
		}()
	}
	<-started
	close(release)
	wg.Wait()
	if count.Load() != 1 {
		t.Fatal("duplicate permission fetches", count.Load())
	}
}

func TestSavedWindowRoles(t *testing.T) {
	root := t.TempDir()
	loader := meta.New(afs.New(), root)
	entries := []SavedWindow{
		{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "open"}, Key: "missing"},
		{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "restricted"}, Key: "missing", Roles: []string{"reader", "admin"}},
	}
	var roles []string
	var failure error
	calls := 0
	catalog, err := NewMetadataWindowCatalog(loader, root, entries, WithWindowRoleResolver(func(context.Context) ([]string, error) { calls++; return roles, failure }))
	if err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		roles   []string
		failure error
		visible int
	}{
		{nil, nil, 1}, {[]string{"Reader"}, nil, 1}, {[]string{"reader"}, nil, 2}, {[]string{"admin"}, nil, 2}, {[]string{"reader"}, errors.New("unavailable"), 1},
	} {
		roles, failure = tt.roles, tt.failure
		list, err := catalog.List(context.Background(), nil)
		if err != nil || len(list.Windows) != tt.visible {
			t.Fatal(list, err)
		}
		if tt.visible == 1 {
			_, err = catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "restricted"})
			if err == nil || err.Error() != "window definition is not available" {
				t.Fatal("denial loaded missing source", err)
			}
		}
	}
	before := calls
	_, err = catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "open"})
	if calls != before || err == nil || err.Error() == "window definition is not available" {
		t.Fatal("open window used role resolver", err)
	}
	noResolver, err := NewMetadataWindowCatalog(loader, root, entries)
	if err != nil {
		t.Fatal(err)
	}
	list, err := noResolver.List(context.Background(), nil)
	if err != nil || len(list.Windows) != 1 {
		t.Fatal("missing resolver allowed configured roles", list, err)
	}
}
