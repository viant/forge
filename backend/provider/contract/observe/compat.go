// Package observe retains source compatibility with the shared MCP implementation.
package observe

import shared "github.com/viant/mcp/client/observe"

const Authorization = shared.Authorization
const BindingResolver = shared.BindingResolver
const CacheBypass = shared.CacheBypass
const CacheHit = shared.CacheHit
const CacheMiss = shared.CacheMiss
const CacheUnknown = shared.CacheUnknown
const Canceled = shared.Canceled
const Denied = shared.Denied
const Error = shared.Error
const GatewayDefinitionDecode = shared.GatewayDefinitionDecode
const GatewayMCPCall = shared.GatewayMCPCall
const GatewayRequestEncode = shared.GatewayRequestEncode
const GatewayResponseDecode = shared.GatewayResponseDecode
const GatewayTool = shared.GatewayTool
const HTTPRequest = shared.HTTPRequest
const HTTPResponseEncode = shared.HTTPResponseEncode
const HTTPWindowBind = shared.HTTPWindowBind
const HTTPWindowPermission = shared.HTTPWindowPermission
const HTTPWindowResolve = shared.HTTPWindowResolve
const Identity = shared.Identity
const MCPDispatch = shared.MCPDispatch
const MenuVisibility = shared.MenuVisibility
const OK = shared.OK
const ProviderGet = shared.ProviderGet
const ProviderList = shared.ProviderList
const ProviderNamespaceGet = shared.ProviderNamespaceGet
const ProviderNamespaceList = shared.ProviderNamespaceList
const ProviderWrite = shared.ProviderWrite
const RevisionRead = shared.RevisionRead
const RevisionResolve = shared.RevisionResolve
const Serialization = shared.Serialization
const SourceInventory = shared.SourceInventory
const SourceLookup = shared.SourceLookup
const SourceMetadata = shared.SourceMetadata
const SourceWrite = shared.SourceWrite
const Validation = shared.Validation

type Cache = shared.Cache
type Collector = shared.Collector
type Event = shared.Event
type Labels = shared.Labels
type Observer = shared.Observer
type ObserverFunc = shared.ObserverFunc
type Outcome = shared.Outcome
type Phase = shared.Phase
type Span = shared.Span

var Enabled = shared.Enabled
var HTTP = shared.HTTP
var OutcomeFor = shared.OutcomeFor
var Start = shared.Start
var WithObserver = shared.WithObserver
