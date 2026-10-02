package service

import (
	"context"
	"errors"
	"sync"
	"time"
)

// WindowPrincipal is a verified OAuth identity. Tenant separates application
// permission domains for the same issuer and subject.
type WindowPrincipal struct {
	Issuer  string
	Subject string
	Tenant  string
}

// WindowPermissionProvider is implemented by the application's OAuth adapter.
// Authenticate must validate the current request on every call, including cache
// hits. Permissions obtains trusted user permission info on the server.
type WindowPermissionProvider interface {
	Authenticate(context.Context) (WindowPrincipal, error)
	Permissions(context.Context, WindowPrincipal) ([]string, error)
}

type windowPermissionEntry struct {
	ready   chan struct{}
	roles   []string
	expires time.Time
	err     error
}

// NewCachedWindowRoleResolver caches successful permission lookups for five
// minutes. Authentication failures and provider errors never grant access.
// The cache is instance-local and bounded to 1024 identities.
func NewCachedWindowRoleResolver(provider WindowPermissionProvider) WindowRoleResolver {
	return newCachedWindowRoleResolver(provider, time.Now)
}

func newCachedWindowRoleResolver(provider WindowPermissionProvider, now func() time.Time) WindowRoleResolver {
	var mu sync.Mutex
	entries := map[WindowPrincipal]*windowPermissionEntry{}
	return func(ctx context.Context) ([]string, error) {
		if provider == nil {
			return nil, errors.New("window permission provider is not configured")
		}
		principal, err := provider.Authenticate(ctx)
		if err != nil {
			return nil, err
		}
		if principal.Issuer == "" || principal.Subject == "" {
			return nil, errors.New("verified OAuth issuer and subject are required")
		}
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		mu.Lock()
		entry := entries[principal]
		if entry != nil && !entry.expires.IsZero() && !now().Before(entry.expires) {
			delete(entries, principal)
			entry = nil
		}
		if entry != nil {
			mu.Unlock()
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-entry.ready:
			}
			return append([]string(nil), entry.roles...), entry.err
		}
		if len(entries) >= 1024 {
			for key, value := range entries {
				if !value.expires.IsZero() {
					delete(entries, key)
					break
				}
			}
			if len(entries) >= 1024 {
				mu.Unlock()
				return nil, errors.New("window permission cache is busy")
			}
		}
		entry = &windowPermissionEntry{ready: make(chan struct{})}
		entries[principal] = entry
		mu.Unlock()
		roles, err := provider.Permissions(ctx, principal)
		if err == nil {
			err = ctx.Err()
		}
		mu.Lock()
		entry.err = err
		if err == nil {
			entry.roles = append([]string(nil), roles...)
			entry.expires = now().Add(5 * time.Minute)
		} else {
			delete(entries, principal)
		}
		close(entry.ready)
		mu.Unlock()
		return append([]string(nil), entry.roles...), entry.err
	}
}
