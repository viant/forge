package types

// ConsumerWindow returns a detached presentation header. Dependency definitions,
// hashes and execution receipts remain in the server's admitted window instance.
func ConsumerWindow(window *Window) *Window {
	if window == nil {
		return nil
	}
	public := *window
	public.ResourceDependencies = nil
	public.ResourceTarget = ConsumerWindowTarget(window.ResourceTarget)
	return &public
}

// ConsumerWindowTarget retains only presentation dimensions and the opaque
// selection token. It cannot authorize reads without the server-held instance.
func ConsumerWindowTarget(target *WindowTarget) *WindowTarget {
	if target == nil {
		return nil
	}
	public := *target
	public.DependencyPins = nil
	public.ExecutionProof = nil
	return &public
}

// SameConsumerWindowTarget never treats caller-supplied private pins as authority.
func SameConsumerWindowTarget(public, admitted *WindowTarget) bool {
	if public != nil && (len(public.DependencyPins) != 0 || public.ExecutionProof != nil) {
		return false
	}
	return SameWindowTarget(public, ConsumerWindowTarget(admitted))
}
