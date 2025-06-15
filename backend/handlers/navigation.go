package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/viant/afs/url"
	"github.com/viant/forge/backend/service/file"
	"github.com/viant/forge/backend/types"
	"gopkg.in/yaml.v3"
	"net/http"
)

type NavigationResponse struct {
	Status int                    `json:"status"`
	Data   []types.NavigationItem `json:"data"`
}

// NavigationHandler fetches navigation data using the file.Service.
func NavigationHandler(fs *file.Service, baseURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		navigation, err := FetchNavigationData(r.Context(), fs, baseURL)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		resp := NavigationResponse{
			Status: http.StatusOK,
			Data:   navigation,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

// FetchNavigationData navigation data using the file.Service.
func FetchNavigationData(ctx context.Context, fs *file.Service, baseURL string) ([]types.NavigationItem, error) {
	URL := url.Join(baseURL, "navigation.yaml")
	data, err := fs.Download(ctx, URL) // Fetch as a file
	if err != nil {
		return nil, fmt.Errorf("failed to load navigation data: %w", err)
	}

	var navigation []types.NavigationItem
	if err := yaml.Unmarshal(data, &navigation); err != nil {
		return nil, fmt.Errorf("failed to parse navigation data: %w", err)
	}
	return navigation, nil
}
