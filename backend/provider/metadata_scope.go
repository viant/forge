// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"errors"
	"reflect"
)

// MetadataReadScope binds metadata reads to one current verified principal,
// account and authority revision. Execution and UI actions do not use it.
type MetadataReadScope interface {
	BeginMetadataRead(context.Context) (context.Context, func() error, error)
	WithoutMetadataRead(context.Context) context.Context
}

type metadataScopeMarker struct{}
type metadataScopeDisabled struct{}

// BeginMetadataReadScope opens the outermost metadata scope. Nested Forge and
// embedding-host list/get calls reuse its request context and leave finalization
// to the outer caller.
func BeginMetadataReadScope(ctx context.Context, scope MetadataReadScope) (context.Context, func() error, error) {
	if ctx == nil {
		return nil, nil, errors.New("metadata read context is required")
	}
	if metadataReadScopeIsNil(scope) || metadataScopeIsDisabled(ctx) {
		return ctx, func() error { return nil }, nil
	}
	if active, ok := ctx.Value(metadataScopeMarker{}).(MetadataReadScope); ok && sameMetadataReadScope(active, scope) {
		return ctx, func() error { return nil }, nil
	}
	scoped, finish, err := scope.BeginMetadataRead(ctx)
	if err != nil {
		if finish != nil {
			err = errors.Join(err, finish())
		}
		return nil, nil, err
	}
	if finish == nil {
		return nil, nil, errors.New("metadata scope did not provide a finalizer")
	}
	if scoped == nil {
		if finish != nil {
			err = finish()
		}
		return nil, nil, errors.Join(errors.New("metadata scope returned no request context"), err)
	}
	return context.WithValue(scoped, metadataScopeMarker{}, scope), finish, nil
}

func sameMetadataReadScope(first, second MetadataReadScope) bool {
	firstNil, secondNil := metadataReadScopeIsNil(first), metadataReadScopeIsNil(second)
	if firstNil || secondNil {
		return firstNil && secondNil
	}
	firstValue, secondValue := reflect.ValueOf(first), reflect.ValueOf(second)
	if firstValue.Type() != secondValue.Type() || !firstValue.Comparable() || !secondValue.Comparable() {
		return false
	}
	return firstValue.Interface() == secondValue.Interface()
}

func metadataReadScopeIsNil(scope MetadataReadScope) bool {
	if scope == nil {
		return true
	}
	value := reflect.ValueOf(scope)
	switch value.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Pointer, reflect.Slice:
		return value.IsNil()
	default:
		return false
	}
}

// FinishMetadataReadScope always runs finish after the read and discards the
// result whenever either operation failed.
func FinishMetadataReadScope(finish func() error, readErr error) error {
	if finish == nil {
		return readErr
	}
	return errors.Join(readErr, finish())
}

// WithoutMetadataReadScope marks an internal UI open path so definition loads
// used to construct that open do not masquerade as list/get metadata reads.
func WithoutMetadataReadScope(ctx context.Context, configured ...MetadataReadScope) context.Context {
	if ctx == nil {
		return nil
	}
	if metadataScopeIsDisabled(ctx) {
		return ctx
	}
	var scope MetadataReadScope
	if active, ok := ctx.Value(metadataScopeMarker{}).(MetadataReadScope); ok {
		scope = active
	} else if len(configured) > 0 {
		scope = configured[0]
	}
	if !metadataReadScopeIsNil(scope) {
		ctx = scope.WithoutMetadataRead(ctx)
		if ctx == nil {
			return nil
		}
	}
	return context.WithValue(ctx, metadataScopeDisabled{}, true)
}

func metadataScopeIsDisabled(ctx context.Context) bool {
	if ctx == nil {
		return true
	}
	_, disabled := ctx.Value(metadataScopeDisabled{}).(bool)
	return disabled
}

// MetadataScope returns only the scope explicitly installed by the host.
func (s *Service) MetadataScope() MetadataReadScope {
	if s == nil || s.cfg == nil {
		return nil
	}
	return s.cfg.MetadataScope
}
