package reporting

import (
	"encoding/json"
	"github.com/viant/forge/backend/reporting/materializer"
	identity "github.com/viant/forge/backend/resource"
)

// SectionReadySnapshot is an invocation-local, authorized projection. It is
// never an exportable completed result. Other sections remain explicitly pending.
type SectionReadySnapshot struct {
	Kind       string                           `json:"kind"`
	Resource   *identity.ResolvedResource       `json:"resource"`
	SectionID  string                           `json:"sectionId"`
	Sections   []materializer.SectionNavigation `json:"sections"`
	ReportSpec json.RawMessage                  `json:"reportSpec"`
	ReportFill json.RawMessage                  `json:"reportFill"`
}
