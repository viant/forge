package resource

import (
	"github.com/stretchr/testify/require"
	"testing"
)

// Tests publish complete validated configurations rather than mutating the
// request-serving producer's private maps or callbacks.
func localProviderConfig(p *LocalProvider) LocalConfig {
	return p.provider.Load().ConfigurationSnapshot()
}

func updateLocalProvider(t *testing.T, p *LocalProvider, update func(*LocalConfig)) {
	t.Helper()
	config := localProviderConfig(p)
	update(&config)
	next, err := NewLocalProvider(config)
	require.NoError(t, err)
	p.provider.Store(next.provider.Load())
}

func localProviderBinding(p *LocalProvider, uri string) LocalResourceBinding {
	for _, binding := range localProviderConfig(p).Bindings {
		if binding.URI == uri {
			return binding
		}
	}
	return LocalResourceBinding{}
}

func setLocalConfigBinding(config *LocalConfig, binding LocalResourceBinding) {
	for i := range config.Bindings {
		if config.Bindings[i].URI == binding.URI {
			config.Bindings[i] = binding
			return
		}
	}
	config.Bindings = append(config.Bindings, binding)
}
