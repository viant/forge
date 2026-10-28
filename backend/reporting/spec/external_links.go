package reportspec

import (
	"fmt"
	"net/url"
	"strings"
)

func validateExternalLinks(block Block) error {
	raw, present := block.Runtime["links"]
	if !present {
		return nil
	}
	links, ok := raw.([]any)
	if !ok || len(links) > 16 {
		return fmt.Errorf("report links require at most16 links")
	}
	for _, raw := range links {
		link, ok := raw.(map[string]any)
		if !ok || len(link) != 2 {
			return fmt.Errorf("report link requires label and URL")
		}
		label, _ := link["label"].(string)
		address, _ := link["url"].(string)
		u, err := url.Parse(address)
		if strings.TrimSpace(label) == "" || len(address) > 2048 || err != nil || u.User != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") {
			return fmt.Errorf("report link requires an absolute HTTP(S) URL without credentials")
		}
	}
	return nil
}
