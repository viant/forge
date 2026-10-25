package materializer

// AuthoredDependencyFingerprintError means an authored dependency's bytes no
// longer match its recorded fingerprint. It deliberately retains no authored
// identifier, descriptor, fingerprint or source text.
type AuthoredDependencyFingerprintError struct {
	kind string
}

func (*AuthoredDependencyFingerprintError) Error() string {
	return "authored dependency fingerprint mismatch"
}

// AuthoredDependencyKind identifies a code-owned dependency category, allowing
// hosts to offer source re-import guidance without parsing private error text.
func (e *AuthoredDependencyFingerprintError) AuthoredDependencyKind() string {
	if e == nil {
		return ""
	}
	return e.kind
}
