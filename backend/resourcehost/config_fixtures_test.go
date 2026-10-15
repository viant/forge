// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package resource

// Tests publish complete validated configurations rather than mutating the
// request-serving producer's private maps or callbacks.
func localProviderConfig(p *LocalProvider) LocalConfig {
	return p.provider.Load().ConfigurationSnapshot()
}

func localProviderBinding(p *LocalProvider, uri string) LocalResourceBinding {
	for _, binding := range localProviderConfig(p).Bindings {
		if binding.URI == uri {
			return binding
		}
	}
	return LocalResourceBinding{}
}
