package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/viant/afs/url"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
	"net/http"
	"strings"
)

type WindowResponse struct {
	Status string        `json:"status"`
	Data   *types.Window `json:"data"`
}

// WindowHandler fetches window data using the file.Service.
func WindowHandler(loader *meta.Service, baseURL string, baseURI string) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {
		pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, baseURI), "/")
		if len(pathParts) < 1 || pathParts[0] == "" {
			http.Error(w, "missing path in URL", http.StatusBadRequest)
			return
		}
		path := pathParts[0]
		subPath := strings.Join(pathParts[1:], "/")
		aWindow, err := LoadWindow(r.Context(), loader, baseURL, path, subPath, targetContextFromRequest(r))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		resp := WindowResponse{
			Status: "ok",
			Data:   aWindow,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

// LoadWindow loads window data using the file.Service.
func LoadWindow(ctx context.Context, loader *meta.Service, baseURL, key, subKey string, target *meta.TargetContext) (*types.Window, error) {
	subPath := "main"
	if subKey != "" {
		subPath = subKey + "/main"
	}
	filePath := url.Join(baseURL, key, subPath)
	resolvedBase, err := loader.ResolveWindowBase(ctx, filePath, target)
	if err != nil && subKey == "" {
		resolvedBase, err = loader.ResolveWindowBase(ctx, url.Join(baseURL, key), target)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load window for key %s: %w", key, err)
	}
	result := &types.Window{}
	if err := loader.LoadWithTarget(ctx, resolvedBase+".yaml", result, target); err != nil {
		return nil, fmt.Errorf("failed to load window for key %s: %w", key, err)
	}
	assetPath, assetErr := loader.ResolveWindowAsset(ctx, resolvedBase, ".js", target)
	if assetErr != nil {
		assetPath, assetErr = loader.ResolveWindowAsset(ctx, filePath, ".js", target)
	}
	if assetErr == nil {
		code, err := loader.Download(context.Background(), assetPath)
		if err != nil {
			return nil, err
		}
		result.SetCode(code)
	}
	return result, nil
}
