// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
// Package resource maps workspace/object identities to stable opaque
// policy IDs. The host supplies verified tenant/account and policy namespace.
package resource

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"unicode/utf8"
)

var ErrInvalid = errors.New("Studio policy identity is invalid")

const PolicyVersion = "logical"

type PolicyID struct {
	ID    string
	Tuple [6]string
}

// WorkspacePolicyID uses kind workspace and an empty object ID. The exact
// tuple is retained alongside its digest for audit and mapping verification.
func WorkspacePolicyID(tenantID, accountID, studioKind, workspaceID string) (PolicyID, error) {
	return newPolicyID(tenantID, accountID, studioKind, workspaceID, "workspace", "")
}

func ObjectPolicyID(tenantID, accountID, studioKind, workspaceID, kind, objectID string) (PolicyID, error) {
	if !ValidResourceKind(kind) {
		return PolicyID{}, ErrInvalid
	}
	return newPolicyID(tenantID, accountID, studioKind, workspaceID, kind, objectID)
}

func newPolicyID(tenantID, accountID, studioKind, workspaceID, kind, objectID string) (PolicyID, error) {
	for _, id := range []string{tenantID, accountID, studioKind, workspaceID} {
		if !internalID(id) {
			return PolicyID{}, ErrInvalid
		}
	}
	if kind == "workspace" {
		if objectID != "" {
			return PolicyID{}, ErrInvalid
		}
	} else if !internalID(objectID) {
		return PolicyID{}, ErrInvalid
	}
	tuple := [6]string{tenantID, accountID, studioKind, workspaceID, kind, objectID}
	var payload bytes.Buffer
	encoder := json.NewEncoder(&payload)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(tuple); err != nil {
		return PolicyID{}, err
	}
	compact := bytes.TrimSuffix(payload.Bytes(), []byte("\n"))
	hash := sha256.Sum256(compact)
	return PolicyID{ID: hex.EncodeToString(hash[:]), Tuple: tuple}, nil
}

func internalID(value string) bool {
	if len(value) < 1 || len(value) > 64 || !utf8.ValidString(value) {
		return false
	}
	for i := 0; i < len(value); i++ {
		if value[i] < 33 || value[i] > 126 {
			return false
		}
	}
	return true
}
