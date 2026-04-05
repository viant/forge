package com.viant.forgeandroid.agently

import com.viant.forgeandroid.runtime.EndpointConfig
import com.viant.forgeandroid.runtime.EndpointRegistry
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ForgeTargetContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.serialization.json.Json

data class AgentlyRuntimeBundle(
    val runtime: ForgeRuntime,
    val client: AgentlyClient,
    val endpoints: EndpointRegistry
)

fun createAgentlyRuntimeBundle(
    endpoints: Map<String, EndpointConfig>,
    scope: CoroutineScope,
    clientEndpointName: String = "appAPI",
    targetContext: ForgeTargetContext = ForgeTargetContext(platform = "android"),
    json: Json = Json { ignoreUnknownKeys = true }
): AgentlyRuntimeBundle {
    val registry = EndpointRegistry(endpoints)
    val runtime = ForgeRuntime(
        endpoints = endpoints,
        scope = scope,
        targetContext = targetContext
    )
    val client = AgentlyClient(
        endpoints = registry,
        endpointName = clientEndpointName,
        json = json
    )
    registerAgentlyHandlers(runtime, client)
    return AgentlyRuntimeBundle(
        runtime = runtime,
        client = client,
        endpoints = registry
    )
}

fun createAgentlyRuntime(
    endpoints: Map<String, EndpointConfig>,
    scope: CoroutineScope,
    targetContext: ForgeTargetContext = ForgeTargetContext(platform = "android")
): ForgeRuntime {
    return createAgentlyRuntimeBundle(
        endpoints = endpoints,
        scope = scope,
        clientEndpointName = "appAPI",
        targetContext = targetContext
    ).runtime
}
