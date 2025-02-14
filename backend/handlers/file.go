package handlers

import (
	"context"
	"encoding/json"
	"github.com/viant/forge/backend/service/file"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
)

// FileHandler wraps the Service to serve file operations via HTTP.
type FileHandler struct {
	fs *file.Service
}

// NewFileBrowser creates a FileHandler with the provided Service instance.
func NewFileBrowser(fs *file.Service) *FileHandler {
	return &FileHandler{fs: fs}
}

// ListHandler handles the `/list` endpoint.
func (h *FileHandler) ListHandler(w http.ResponseWriter, r *http.Request) {
	URI := r.URL.Query().Get("uri")
	folderOnly := r.URL.Query().Get("folderOnly") == "true"

	ctx := context.Background()
	// Check if the requested path exists
	exists, err := h.fs.Exists(ctx, URI)
	if err != nil || !exists {
		log.Printf("URI does not exist: %v, error: %v", folderOnly, err)
		http.Error(w, "URI not found", http.StatusNotFound)
		return
	}

	// List the directory contents
	items, err := h.fs.List(ctx, file.WithURI(URI), file.WithOnlyFolder(folderOnly))
	if err != nil {
		log.Printf("Error listing files: %v", err)
		http.Error(w, "Unable to list files", http.StatusInternalServerError)
		return
	}

	// Respond with the JSON list of files
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(items); err != nil {
		log.Printf("Error encoding response: %v", err)
	}
}

// DownloadHandler handles the `/download` endpoint.
func (h *FileHandler) DownloadHandler(w http.ResponseWriter, r *http.Request) {
	URI := r.URL.Query().Get("uri")
	if URI == "" {
		http.Error(w, "Missing path parameter", http.StatusBadRequest)
		return
	}

	// Prevent path traversal attacks
	if strings.Contains(URI, "..") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Check if the file exists
	exists, err := h.fs.Exists(ctx, URI)
	if err != nil || !exists {
		log.Printf("File does not exist: %s, error: %v", URI, err)
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Download the file content
	data, err := h.fs.Download(ctx, URI)
	if err != nil {
		log.Printf("Error downloading file: %v", err)
		http.Error(w, "Unable to download file", http.StatusInternalServerError)
		return
	}

	// Determine the file content type
	contentType := mime.TypeByExtension(filepath.Ext(URI))
	if contentType == "" {
		contentType = "application/octet-stream" // Default binary type if unknown
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(URI))
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}
