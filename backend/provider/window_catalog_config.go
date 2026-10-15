// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

// WindowListMetadataOnly is an explicit host catalog promise that List already
// applies namespace/private-owner and declared group visibility. It grants no
// get/open/execution authority and supplies no runtime pin.
func (s *Service) WindowListMetadataOnly() bool {
	if s == nil || s.cfg == nil || s.cfg.WindowDefinitions == nil {
		return false
	}
	metadata, ok := s.cfg.WindowDefinitions.(interface{ MetadataOnlyWindowList() bool })
	return ok && metadata.MetadataOnlyWindowList()
}

// ConfigureWindowCatalog decorates the host catalog before serving requests.
// It preserves the bridge's hub, admission callbacks and instance pins. This
// startup-only hook must not be called concurrently with request handling.
func (s *Service) ConfigureWindowCatalog(decorate func(WindowDefinitionCatalog) WindowDefinitionCatalog) {
	if s != nil && s.cfg != nil && decorate != nil {
		s.cfg.WindowDefinitions = decorate(s.cfg.WindowDefinitions)
	}
}
