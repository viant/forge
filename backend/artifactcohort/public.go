package artifactcohort

// preparePublicLocked runs only when the publisher replaces a generation.
// It retains an empty public snapshot after withdrawal, but never exposes an
// empty catalog that previously contained private metadata.
func (p *Publisher) preparePublicLocked() {
	wasPublic := p.publicReadable
	p.publicOnly, p.publicReadable = false, false
	p.publicRoots = nil
	p.publicURIs = nil
	p.publicAmbiguous = nil
	if p.manifest == nil || len(p.manifest.Policies) != 0 {
		return
	}
	for _, cohort := range p.manifest.Cohorts {
		if !cohort.Public {
			return
		}
	}
	p.publicOnly = len(p.manifest.Cohorts) != 0
	p.publicReadable = p.publicOnly || wasPublic
	if !p.publicReadable {
		return
	}
	p.publicRoots = map[string]RootRef{}
	p.publicURIs = map[string]RootRef{}
	p.publicAmbiguous = map[string]bool{}
	byTenant := map[string]admission{}
	for _, cohort := range p.manifest.Cohorts {
		held := byTenant[cohort.Tenant]
		if held.cohorts == nil {
			held = admission{tenant: cohort.Tenant, cohorts: map[string]string{}}
		}
		held.cohorts[cohort.Name] = cohort.PolicyHash
		byTenant[cohort.Tenant] = held
	}
	for _, cohort := range p.manifest.Cohorts {
		roots, err := effectiveRoots(*p.manifest, byTenant[cohort.Tenant], cohort.Name)
		if err != nil {
			continue // An ambiguous selection grants no public fetch.
		}
		for _, root := range roots {
			p.publicRoots[cohort.Tenant+"\x00"+RootKey(root)] = root
			key := cohort.Tenant + "\x00" + root.URI
			if prior, ok := p.publicURIs[key]; ok && prior != root {
				p.publicAmbiguous[key] = true
			}
			p.publicURIs[key] = root
		}
	}
}

// PublicOnly is prepared publication metadata, not permission to perform a
// subsequent unrestricted read. Use the atomic PublicSnapshot/FetchPublic APIs.
func (p *Publisher) PublicOnly() bool {
	if p == nil {
		return false
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.publicOnly
}

// PublicReadable includes an authoritative empty snapshot after withdrawal.
// This is a hint; atomic public reads still perform their own generation check.
func (p *Publisher) PublicReadable() bool {
	if p == nil {
		return false
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.publicReadable
}

func (p *Publisher) PublicSnapshot() (Manifest, error) {
	if p == nil {
		return Manifest{}, ErrUnavailable
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.manifest == nil {
		return Manifest{}, ErrUnavailable
	}
	if !p.publicReadable {
		return Manifest{}, ErrDenied
	}
	return CloneManifest(*p.manifest)
}

// FetchPublic checks exact current public membership and reads immutable bytes
// under the same generation lock. Retained, withdrawn and private versions do
// not become public merely because their bytes are still stored.
func (p *Publisher) FetchPublic(input FetchInput) (*Artifact, error) {
	if p == nil {
		return nil, ErrUnavailable
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	if !p.publicReadable {
		return nil, ErrDenied
	}
	ref, ok := p.publicRoots[input.Tenant+"\x00"+RootKey(input.Root)]
	if !ok || ref != input.Root {
		return nil, ErrDenied
	}
	artifact := p.versions[RootKey(ref)]
	if artifact == nil || artifact.Root != ref {
		return nil, ErrUnavailable
	}
	return CloneArtifact(artifact), nil
}

// LookupPublicRoot is an indexed metadata read. Absence is authoritative only
// after publication; callers retain their ordinary path for nonpublic roots.
func (p *Publisher) LookupPublicRoot(tenant, uri string) (RootRef, bool, error) {
	if p == nil {
		return RootRef{}, false, ErrUnavailable
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.manifest == nil {
		return RootRef{}, false, ErrUnavailable
	}
	if !p.publicReadable {
		return RootRef{}, false, nil
	}
	key := tenant + "\x00" + uri
	if p.publicAmbiguous[key] {
		return RootRef{}, false, ErrConflict
	}
	ref, ok := p.publicURIs[key]
	return ref, ok, nil
}
