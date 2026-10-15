package reporting

import (
	"context"
	"github.com/viant/forge/backend/reporting/catalog"
	"github.com/viant/forge/backend/types"
	"time"
)

const SourceKindReportSpec = "reportSpec"

type Options struct {
	Compiler                   Compiler
	ReportCatalog              catalog.Provider
	ResourceResolver           ResourceResolver
	ResourceDependencyResolver ResourceDependencyResolver
	ResourceDependencyProof    types.WindowTargetProof
	Now                        func() time.Time
	Audit                      AuditSink
	ActorID                    func(context.Context) string
}
type Service struct {
	compiler                   Compiler
	reportCatalog              catalog.Provider
	resourceResolver           ResourceResolver
	resourceReaderFactory      ResourceReaderFactory
	resourceDependencyResolver ResourceDependencyResolver
	resourceDependencyProof    types.WindowTargetProof
	resourceDatasetExecutor    ResourceDatasetExecutor
	now                        func() time.Time
	audit                      AuditSink
	actorID                    func(context.Context) string
}

func New(o Options) *Service {
	if o.Now == nil {
		o.Now = time.Now
	}
	if o.ActorID == nil {
		o.ActorID = func(context.Context) string { return "" }
	}
	return &Service{compiler: o.Compiler, reportCatalog: o.ReportCatalog, resourceResolver: o.ResourceResolver, resourceDependencyResolver: o.ResourceDependencyResolver, resourceDependencyProof: o.ResourceDependencyProof, now: o.Now, audit: o.Audit, actorID: o.ActorID}
}
func (s *Service) recordAudit(ctx context.Context, event *AuditEvent) {
	if s != nil && s.audit != nil && event != nil {
		_ = s.audit.Record(ctx, cloneAuditEvent(event))
	}
}
