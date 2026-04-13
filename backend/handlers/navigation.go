package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
	"net/http"
)

type NavigationResponse struct {
	Status string                 `json:"status"`
	Data   []types.NavigationItem `json:"data"`
}

// NavigationHandler fetches navigation data using the metadata service.
func NavigationHandler(loader *meta.Service, baseURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		navigation, err := FetchNavigationData(r.Context(), loader, baseURL, targetContextFromRequest(r))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		resp := NavigationResponse{
			Status: "ok",
			Data:   navigation,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

// FetchNavigationData loads navigation metadata using the same target-aware
// branch selection as window metadata.
func FetchNavigationData(ctx context.Context, loader *meta.Service, baseURL string, target *meta.TargetContext) ([]types.NavigationItem, error) {
	base, err := loader.ResolveWindowBase(ctx, "navigation", target)
	if err != nil {
		return nil, fmt.Errorf("failed to load navigation data: %w", err)
	}
	var navigation []types.NavigationItem
	if err := loader.LoadWithTarget(ctx, base+".yaml", &navigation, target); err != nil {
		return nil, fmt.Errorf("failed to parse navigation data: %w", err)
	}
	return navigation, nil
}
