package types

import "time"

// LocalStateOwner fences private in-memory UI restoration. It grants no access.
// Only a verified host callback may attach it after normal metadata admission.
type LocalStateOwner struct {
	Binding    string    `json:"binding"`
	ValidUntil time.Time `json:"validUntil"`
}
