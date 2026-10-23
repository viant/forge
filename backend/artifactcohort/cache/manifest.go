package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/viant/forge/backend/artifactcohort"
)

// FileManifestStore persists indexes, not user admissions. Replica confirms
// the saved hash with its authenticated producer before enabling local use.
// Each configured provider/tenant/account has a separate atomic cache file.
type FileManifestStore struct{ Directory string }
type manifestRecord struct {
	Source   string                  `json:"source"`
	Tenant   string                  `json:"tenant"`
	Account  string                  `json:"account"`
	Manifest artifactcohort.Manifest `json:"manifest"`
}

func (s FileManifestStore) path(source, tenant, account string) (string, error) {
	if s.Directory == "" || source == "" || tenant == "" || account == "" {
		return "", artifactcohort.ErrInvalid
	}
	key, _ := json.Marshal([]string{source, tenant, account})
	return filepath.Join(s.Directory, artifactcohort.Hash(key)+".json"), nil
}
func (s FileManifestStore) Load(ctx context.Context, source, tenant, account string) (artifactcohort.Manifest, error) {
	if err := ctx.Err(); err != nil {
		return artifactcohort.Manifest{}, err
	}
	path, err := s.path(source, tenant, account)
	if err != nil {
		return artifactcohort.Manifest{}, err
	}
	f, err := os.Open(path)
	if err != nil {
		return artifactcohort.Manifest{}, err
	}
	defer f.Close()
	var record manifestRecord
	decoder := json.NewDecoder(io.LimitReader(f, 16<<20))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(&record); err != nil {
		return artifactcohort.Manifest{}, err
	}
	if decoder.Decode(new(any)) != io.EOF || record.Source != source || record.Tenant != tenant || record.Account != account {
		return artifactcohort.Manifest{}, artifactcohort.ErrInvalid
	}
	if err = artifactcohort.ValidateManifest(record.Manifest); err != nil {
		return artifactcohort.Manifest{}, err
	}
	return record.Manifest, nil
}
func (s FileManifestStore) Save(ctx context.Context, source, tenant, account string, manifest artifactcohort.Manifest) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := artifactcohort.ValidateManifest(manifest); err != nil {
		return err
	}
	path, err := s.path(source, tenant, account)
	if err != nil {
		return err
	}
	raw, err := json.Marshal(manifestRecord{source, tenant, account, manifest})
	if err != nil {
		return err
	}
	if len(raw) > 16<<20 {
		return fmt.Errorf("artifact manifest exceeds cache limit")
	}
	if err = os.MkdirAll(s.Directory, 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(s.Directory, ".manifest-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if _, err = f.Write(raw); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
