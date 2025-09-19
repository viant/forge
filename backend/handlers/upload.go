package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"github.com/viant/forge/backend/service/file"
	"io"
	"log"
	"net/http"
	"path"
)

// newUUID generates a RFC4122-like UUID v4 string without external deps.
func newUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// fallback: hex-encoded zeros (still unique enough per process for temp usage)
		return "00000000-0000-4000-8000-000000000000"
	}
	// Set version (4) and variant (10)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	// Format 8-4-4-4-12
	hexStr := hex.EncodeToString(b)
	return hexStr[0:8] + "-" + hexStr[8:12] + "-" + hexStr[12:16] + "-" + hexStr[16:20] + "-" + hexStr[20:32]
}

// UploadHandler handles multipart file uploads and stores them via file.Service in a staging folder.
// Staging path format: .tmp/uploads/<uuid>/<original-name>
// Returns: { name, size, uri, stagingFolder }
func UploadHandler(fs *file.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(32 << 20); err != nil { // 32MB memory buffer
			http.Error(w, "invalid multipart form", http.StatusBadRequest)
			return
		}

		fileHeader := r.MultipartForm.File["file"]
		if len(fileHeader) == 0 {
			http.Error(w, "missing file field", http.StatusBadRequest)
			return
		}

		fh := fileHeader[0]
		src, err := fh.Open()
		if err != nil {
			http.Error(w, "unable to open upload", http.StatusInternalServerError)
			return
		}
		defer src.Close()

		payload, err := io.ReadAll(src)
		if err != nil {
			http.Error(w, "unable to read upload", http.StatusInternalServerError)
			return
		}

		name := fh.Filename
		uuid := newUUID()
		stagingFolder := path.Join(".tmp", "uploads", uuid)
		target := path.Join(stagingFolder, name)

		if err := fs.Upload(r.Context(), target, payload); err != nil {
			log.Printf("upload failed: %v", err)
			http.Error(w, "unable to store file", http.StatusInternalServerError)
			return
		}

		// Build response
		resp := map[string]interface{}{
			"name":          name,
			"size":          fh.Size,
			"uri":           target,
			"stagingFolder": stagingFolder,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}
