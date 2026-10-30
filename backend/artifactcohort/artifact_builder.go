package artifactcohort

import (
	"context"
	"encoding/json"
)

// ArtifactBuilder adapts a producer's typed representation to the existing artifact
// wire contract. Custom encoding and validation are optional; neither grants
// access, selects a release, or performs runtime permission checks.
type ArtifactBuilder[T any] struct {
	Encode   func(context.Context, T) (json.RawMessage, error)
	Validate func(context.Context, T) error
}

// Build closes a typed producer value into detached, canonical artifact bytes.
// It does not publish or retain the result. The ordinary release transaction
// remains responsible for source ownership, selected revisions, and activation.
func (b ArtifactBuilder[T]) Build(ctx context.Context, root RootRef, value T) (*Artifact, error) {
	if ctx == nil {
		return nil, ErrInvalid
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if b.Validate != nil {
		if err := b.Validate(ctx, value); err != nil {
			return nil, err
		}
	}
	var raw json.RawMessage
	var err error
	if b.Encode != nil {
		raw, err = b.Encode(ctx, value)
	} else {
		raw, err = json.Marshal(value)
	}
	if err != nil {
		return nil, err
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	return canonicalArtifact(root, raw)
}

func canonicalArtifact(root RootRef, payload json.RawMessage) (*Artifact, error) {
	// Match encoding/json's RawMessage normalization on the MCP wire.
	canonical, err := json.Marshal(payload)
	if err != nil {
		return nil, ErrInvalid
	}
	candidate := &Artifact{Root: RootRef{URI: root.URI, Kind: root.Kind, Version: root.Version, Hash: Hash(canonical)}, Payload: canonical}
	if root.Hash != "" && root.Hash != candidate.Root.Hash {
		return nil, ErrInvalid
	}
	if err = ValidateArtifact(candidate); err != nil {
		return nil, err
	}
	return candidate, nil
}
