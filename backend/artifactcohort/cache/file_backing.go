package cache

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"github.com/viant/forge/backend/provider/contract/observe"
	"os"
	"path/filepath"
	"strings"
)

// FileBacking is an immutable content-addressed gzip store. It stores only
// payload bytes by hash; the trusted manifest supplies root/version binding.
type FileBacking struct{ dir string }

func NewFileBacking(dir string) (*FileBacking, error) {
	if strings.TrimSpace(dir) == "" {
		return nil, errors.New("backing directory required")
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	return &FileBacking{dir: dir}, nil
}
func validHash(hash string) bool {
	if len(hash) != 64 {
		return false
	}
	for _, char := range hash {
		if char < '0' || char > '9' && char < 'a' || char > 'f' {
			return false
		}
	}
	return true
}
func (f *FileBacking) filename(hash string) (string, error) {
	if f == nil || !validHash(hash) {
		return "", ErrMissing
	}
	return filepath.Join(f.dir, hash[:2], hash+".gz"), nil
}
func (f *FileBacking) Has(ctx context.Context, hash string) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	path, err := f.filename(hash)
	if err != nil {
		return false, err
	}
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if !info.Mode().IsRegular() {
		return false, ErrImmutable
	}
	return true, nil
}
func (f *FileBacking) Load(ctx context.Context, hash string) (data []byte, failure error) {
	span := observe.Start(ctx, PhaseFileLoad, cacheLabels)
	defer func() { span.End(observe.OutcomeFor(failure), observe.CacheUnknown) }()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	path, err := f.filename(hash)
	if err != nil {
		return nil, err
	}
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return nil, ErrMissing
	}
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, ErrImmutable
	}
	return os.ReadFile(path)
}
func (f *FileBacking) Save(ctx context.Context, hash string, value []byte) (failure error) {
	span := observe.Start(ctx, PhaseFileStore, cacheLabels)
	defer func() { span.End(observe.OutcomeFor(failure), observe.CacheUnknown) }()
	if err := ctx.Err(); err != nil {
		return err
	}
	path, err := f.filename(hash)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	var nonce [12]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return err
	}
	temp := path + ".tmp-" + hex.EncodeToString(nonce[:])
	file, err := os.OpenFile(temp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	defer os.Remove(temp)
	if _, err = file.Write(value); err != nil {
		file.Close()
		return err
	}
	if err = file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	if err = os.Link(temp, path); err == nil {
		return nil
	}
	if !os.IsExist(err) {
		return err
	}
	held, loadErr := f.Load(ctx, hash)
	if loadErr != nil {
		return loadErr
	}
	if !bytes.Equal(held, value) {
		return ErrImmutable
	}
	return nil
}
