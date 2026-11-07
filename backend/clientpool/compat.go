// Package manager retains source compatibility with the shared MCP implementation.
package manager

import shared "github.com/viant/mcp/client/pool"

const ClientCapacityEvicted = shared.ClientCapacityEvicted
const ClientIdleEvicted = shared.ClientIdleEvicted
const ClientRetired = shared.ClientRetired
const ClientTransportEvicted = shared.ClientTransportEvicted

type AuthBindingStore = shared.AuthBindingStore
type AuthRTProvider = shared.AuthRTProvider
type AuthSelection = shared.AuthSelection
type ClientEviction = shared.ClientEviction
type ClientEvictionReason = shared.ClientEvictionReason
type CredentialErrorHandler = shared.CredentialErrorHandler
type DefinitionReader = shared.DefinitionReader
type DelegatedHTTPTransport = shared.DelegatedHTTPTransport
type DelegatedHTTPTransportProvider = shared.DelegatedHTTPTransportProvider
type HTTPAttempt = shared.HTTPAttempt
type JarProvider = shared.JarProvider
type LinkRequiredError = shared.LinkRequiredError
type MCPAuthBinding = shared.MCPAuthBinding
type Manager = shared.Manager
type Option = shared.Option
type Provider = shared.Provider
type SkillsClient = shared.SkillsClient
type StateStore = shared.StateStore
type TokenContextPreparer = shared.TokenContextPreparer
type UserIDExtractor = shared.UserIDExtractor
type VisibleCatalogPartition = shared.VisibleCatalogPartition

var ErrBrowserExecutionRequired = shared.ErrBrowserExecutionRequired
var ErrClientCapacity = shared.ErrClientCapacity
var LinkRequired = shared.LinkRequired
var New = shared.New
var NewAuthBindingStore = shared.NewAuthBindingStore
var WithAuthBindingStore = shared.WithAuthBindingStore
var WithAuthRoundTripper = shared.WithAuthRoundTripper
var WithAuthRoundTripperProvider = shared.WithAuthRoundTripperProvider
var WithAuthSelectionObserver = shared.WithAuthSelectionObserver
var WithClientFactory = shared.WithClientFactory
var WithCookieJar = shared.WithCookieJar
var WithCookieJarProvider = shared.WithCookieJarProvider
var WithCredentialErrorHandler = shared.WithCredentialErrorHandler
var WithCredentialResolver = shared.WithCredentialResolver
var WithDelegatedHTTPTransport = shared.WithDelegatedHTTPTransport
var WithHTTPAttemptObserver = shared.WithHTTPAttemptObserver
var WithHandlerFactory = shared.WithHandlerFactory
var WithMaxClients = shared.WithMaxClients
var WithNamesMemo = shared.WithNamesMemo
var WithNewToolCatalogReadSnapshot = shared.WithNewToolCatalogReadSnapshot
var WithPersistentToolCatalog = shared.WithPersistentToolCatalog
var WithProviderRegistry = shared.WithProviderRegistry
var WithRequestCatalog = shared.WithRequestCatalog
var WithTTL = shared.WithTTL
var WithTokenContextPreparer = shared.WithTokenContextPreparer
var WithToolCatalogReadSnapshot = shared.WithToolCatalogReadSnapshot
var WithUserIDExtractor = shared.WithUserIDExtractor
