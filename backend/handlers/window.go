package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/viant/afs/url"
	"github.com/viant/forge/backend/service/window"
	"github.com/viant/forge/backend/types"
	"net/http"

	"strings"
)

// WindowHandler fetches window data using the file.Service.
func WindowHandler(loader *window.Service, baseURL string, baseURI string) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {
		pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, baseURI), "/")
		if len(pathParts) < 1 || pathParts[0] == "" {
			http.Error(w, "missing path in URL", http.StatusBadRequest)
			return
		}
		path := pathParts[0]
		subPath := strings.Join(pathParts[1:], "/")
		aWindow, err := loadWindow(r.Context(), loader, baseURL, path, subPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(aWindow)
	}
}

// Loads window data using the file.Service.
func loadWindow(ctx context.Context, loader *window.Service, baseURL, key, subKey string) (*types.Window, error) {
	subPath := "main"
	if subKey != "" {
		subPath = subKey + "/main"
	}
	filePath := url.Join(baseURL, key, subPath)
	result := &types.Window{}
	err := loader.Load(ctx, filePath+".yaml", result)
	if err != nil {
		return nil, fmt.Errorf("failed to load window for key %s: %w", key, err)
	}
	if ok, _ := loader.Exists(context.Background(), filePath+".js"); ok {
		code, err := loader.Download(context.Background(), filePath+".js")
		if err != nil {
			return nil, err
		}
		result.SetCode(code)
	}
	return result, nil
}
