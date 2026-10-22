# Previous-period dataset window

A secondary authored dataset may use the same authorized datasource as the current
period, selecting a different bounded date interval without adding a reader:

```yaml
scope:
  mode: override
  relativeDateRange:
    preset: previousPeriod
    startParamPath: filters.from
    endParamPath: filters.to
```

The primary dataset must remain in the report and supply both selected civil date
bounds at these paths. The secondary interval ends the day before the primary
start and contains the same inclusive number of days. September 21–October 20
therefore compares with August 22–September 20. Leap days, year boundaries, and
DST do not change this calculation. It is not anchored to today's date.

Only the date paths change. Advertiser, campaign, and other inherited filters stay
in the request. The datasource's normal server-side authorization, subscription,
and maximum-date-window checks still apply independently to each execution.
The policy cannot be attached to the primary dataset, used with an inherit/append
scope, or evaluated with missing, invalid, or reversed dates. Compilation fails
rather than guessing a period. Recompiling a resolved spec derives from the
primary request again and cannot shift the previous period a second time.

Implementation status: browser request lowering, Go ReportSpec compilation, and
the embedded authored-report lowerer are implemented. Boundary, inherited-filter,
recompilation, declaration-order, fresh execution-parameter binding, and bundled synthetic-envelope tests cover the
policy. The ten existing ReportSpec, ReportFill, and print golden fixtures remain
unchanged. The tracked materializer build entrypoint and pinned lockfile now
regenerate the embedded bundle reproducibly. No published dashboard uses the
policy yet; upstream publication and report wiring remain required.

For an execution whose dates are supplied by the viewer, the resource engine
passes those values into compilation. Only aliases declared by the approved
builder's predicates enter the base request before lowering. The materializer
validates the original envelope and fingerprints before applying this base request
to its temporary builder copy. This permits shared reports without saved date
bounds to derive the prior period from the current invocation. Ordinary dataset
argument binding, datasource admission, and resource revalidation still run.
