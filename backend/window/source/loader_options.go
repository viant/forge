// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"context"
	"github.com/viant/afs"
)

// LoaderOptions injects a host-owned filesystem through native window, import,
// assignment and descriptor loading. Check reports sticky access denials even
// when legacy branch probing or optional-asset loading suppresses an error.
type LoaderOptions struct {
	// StaticAssets is optional and exists only inside one source compilation.
	StaticAssets       *StaticAssetCompilation
	SourceCatalog      func(bool)
	SourceFileSelected func(context.Context, string) error
	// SharedDefault permits a shared/main native root when no main/singleton alias exists.
	SharedDefault    bool
	FS               afs.Service
	AssetDirectories func(context.Context) (map[string]bool, error)
	Check            func() error
}

func (o LoaderOptions) filesystem() afs.Service {
	if o.FS != nil {
		return o.FS
	}
	return afs.New()
}
func (o LoaderOptions) check() error {
	if o.Check != nil {
		return o.Check()
	}
	return nil
}
