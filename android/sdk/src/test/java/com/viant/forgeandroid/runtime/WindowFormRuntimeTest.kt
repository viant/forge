package com.viant.forgeandroid.runtime

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers

class WindowFormRuntimeTest {
    @Test
    fun openWindowInlineSeedsWindowFormFromMetadataOnInitConstants() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )

        val state = runtime.openWindowInline(
            windowKey = "metrics",
            title = "Metrics",
            metadata = WindowMetadata(
                on = listOf(
                    ExecutionDef(
                        event = "onInit",
                        handler = "dataSource.setWindowFormData",
                        parameters = listOf(
                            ParameterDef(name = "granularity", input = "const", location = "day"),
                            ParameterDef(name = "periodView", input = "const", location = "today")
                        )
                    )
                )
            )
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        assertEquals("day", windowForm["granularity"])
        assertEquals("today", windowForm["periodView"])
    }

    @Test
    fun openWindowInlineSeedsWindowFormFromJsonConstantValues() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )

        val state = runtime.openWindowInline(
            windowKey = "metrics",
            title = "Metrics",
            metadata = WindowMetadata(
                on = listOf(
                    ExecutionDef(
                        event = "onInit",
                        handler = "dataSource.setWindowFormData",
                        parameters = listOf(
                            ParameterDef(
                                name = "prefill",
                                input = "const",
                                value = JsonUtil.anyToElement(
                                    mapOf(
                                        "platforms" to listOf("phone", "tablet"),
                                        "enabled" to true
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )

        val prefill = JsonUtil.asStringMap(runtime.windowFormValue(state.windowId)["prefill"])
        assertEquals(listOf("phone", "tablet"), prefill["platforms"])
        assertEquals(true, prefill["enabled"])
    }

    @Test
    fun setWindowFormValueMergesNestedMaps() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(windowKey = "metrics", title = "Metrics", metadata = WindowMetadata())

        runtime.setWindowFormValue(
            state.windowId,
            mapOf(
                "prefill" to mapOf(
                    "accountId" to 7
                )
            ),
            replace = true
        )
        runtime.setWindowFormValue(
            state.windowId,
            mapOf(
                "prefill" to mapOf(
                    "segmentId" to 9
                )
            )
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        val prefill = JsonUtil.asStringMap(windowForm["prefill"])
        assertEquals(7, prefill["accountId"])
        assertEquals(9, prefill["segmentId"])
    }

    @Test
    fun setWindowFormValueHonorsNestedReplaceSentinel() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(windowKey = "metrics", title = "Metrics", metadata = WindowMetadata())

        runtime.setWindowFormValue(
            state.windowId,
            mapOf(
                "prefill" to mapOf(
                    "includeCountry" to listOf("US"),
                    "includeDealsPmp" to listOf(101, 102),
                    "includePostalCodeList" to listOf(303)
                ),
                "capacityCubeBuilder" to mapOf(
                    "chartSpec" to mapOf(
                        "title" to "Area by Date and Channel",
                        "seriesField" to "channelV2"
                    )
                )
            ),
            replace = true
        )
        runtime.setWindowFormValue(
            state.windowId,
            mapOf(
                "prefill" to mapOf(
                    "includeDealsPmp" to mapOf(
                        "\$replace" to true,
                        "value" to listOf(201)
                    ),
                    "includePostalCodeList" to mapOf(
                        "\$replace" to true,
                        "value" to emptyList<Int>()
                    )
                ),
                "capacityCubeBuilder" to mapOf(
                    "chartSpec" to mapOf(
                        "\$replace" to true,
                        "value" to mapOf(
                            "title" to "Avails by Date"
                        )
                    )
                )
            )
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        val prefill = JsonUtil.asStringMap(windowForm["prefill"])
        val capacityCubeBuilder = JsonUtil.asStringMap(windowForm["capacityCubeBuilder"])
        val chartSpec = JsonUtil.asStringMap(capacityCubeBuilder["chartSpec"])
        assertEquals(listOf("US"), prefill["includeCountry"])
        assertEquals(listOf(201), prefill["includeDealsPmp"])
        assertEquals(emptyList<Int>(), prefill["includePostalCodeList"])
        assertEquals("Avails by Date", chartSpec["title"])
        assertEquals(null, chartSpec["seriesField"])
        val meta = JsonUtil.asStringMap(windowForm["__forge"])
        assertEquals(2, meta["prefillRevision"])
    }

    @Test
    fun setWindowFormValueBumpsGenericPrefillRevisionForRepeatedHandoffs() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(windowKey = "metrics", title = "Metrics", metadata = WindowMetadata())

        runtime.setWindowFormValue(
            state.windowId,
            mapOf("prefill" to mapOf("recordId" to 7))
        )
        runtime.setWindowFormValue(
            state.windowId,
            mapOf("prefill" to mapOf("recordId" to 7))
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        val meta = JsonUtil.asStringMap(windowForm["__forge"])
        assertEquals(2, meta["prefillRevision"])
    }

    @Test
    fun openWindowInlineSeedsWindowFormFromScopedItems() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )

        val state = runtime.openWindowInline(
            windowKey = "metrics",
            title = "Metrics",
            metadata = WindowMetadata(
                view = ViewDef(
                    content = ContentDef(
                        containers = listOf(
                            ContainerDef(
                                id = "root",
                                items = listOf(
                                    ItemDef(
                                        id = "granularity",
                                        bindingPath = "granularity",
                                        scope = "windowForm",
                                        value = kotlinx.serialization.json.JsonPrimitive("day")
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        assertEquals("day", windowForm["granularity"])
    }

    @Test
    fun openWindowInlineSeedsWindowFormFromGenericItemValueKey() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )

        val state = runtime.openWindowInline(
            windowKey = "metrics",
            title = "Metrics",
            metadata = WindowMetadata(
                view = ViewDef(
                    content = ContentDef(
                        containers = listOf(
                            ContainerDef(
                                id = "root",
                                items = listOf(
                                    ItemDef(
                                        id = "legacyPeriod",
                                        field = "periodType",
                                        scope = "windowForm",
                                        value = kotlinx.serialization.json.JsonPrimitive("rolling")
                                    ),
                                    ItemDef(
                                        id = "ignoredId",
                                        field = "fieldKey",
                                        bindingPath = "bindingKey",
                                        dataField = "dataKey",
                                        scope = "windowForm",
                                        value = kotlinx.serialization.json.JsonPrimitive("explicit")
                                    ),
                                    ItemDef(
                                        id = "   ",
                                        field = "\t",
                                        scope = "windowForm",
                                        value = kotlinx.serialization.json.JsonPrimitive("ignored")
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        assertEquals("rolling", windowForm["periodType"])
        assertEquals("explicit", windowForm["dataKey"])
        assertEquals(null, windowForm["fieldKey"])
        assertEquals(null, windowForm["bindingKey"])
    }

    @Test
    fun dataSourceSetWindowFormDataResolvesWindowFormParameters() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(
            windowKey = "metrics",
            title = "Metrics",
            metadata = WindowMetadata(
                dataSources = mapOf(
                    "runs" to DataSourceDef()
                )
            )
        )

        runtime.setWindowFormValue(
            state.windowId,
            mapOf(
                "prefill" to mapOf(
                    "recordId" to 2637048,
                    "granularity" to "hour"
                )
            ),
            replace = true
        )

        val context = runtime.windowContext(state.windowId).context("runs")
        runtime.execute(
            ExecutionDef(
                handler = "dataSource.setWindowFormData",
                parameters = listOf(
                    ParameterDef(name = "selectedRecordId", input = "windowForm", location = "prefill.recordId"),
                    ParameterDef(name = "selectedGranularity", input = "windowForm", location = "prefill.granularity")
                )
            ),
            context
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        assertEquals(2637048, windowForm["selectedRecordId"])
        assertEquals("hour", windowForm["selectedGranularity"])
    }

    @Test
    fun parameterResolverResolvesWindowFormInputsForDatasourceParameters() {
        val signals = SignalRegistry()
        val metadata = Signal<WindowMetadata?>(null).also {
            it.set(
                WindowMetadata(
                    dataSources = mapOf(
                        "record_performance_period_today" to DataSourceDef(
                            parameters = listOf(
                                ParameterDef(name = "record_id", input = "windowForm", location = "recordId.0"),
                                ParameterDef(name = "period", input = "const", location = "today"),
                                ParameterDef(name = "granularity", input = "windowForm", location = "granularity")
                            )
                        )
                    )
                )
            )
        }
        val runtime = DataSourceRuntime(
            signals = signals,
            restClient = RestClient(EndpointRegistry(emptyMap())),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val window = WindowContext(
            windowId = "recordWindow",
            metadata = metadata,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val context = runtime.attach(window, "record_performance_period_today")
        signals.form(WindowIdentity("recordWindow").windowFormId()).set(
            mapOf(
                "recordId" to listOf(2673453),
                "granularity" to "day"
            )
        )

        val resolved = ParameterResolver().resolveFlat(
            context.dataSource.parameters,
            context
        )

        assertEquals("2673453", resolved["record_id"]?.toString())
        assertEquals("today", resolved["period"])
        assertEquals("day", resolved["granularity"])
    }

    @Test
    fun parameterResolverResolvesCompactRowsIntoInputQuery() {
        val signals = SignalRegistry()
        val metadata = Signal<WindowMetadata?>(null).also {
            it.set(
                WindowMetadata(
                    dataSources = mapOf(
                        "runs" to DataSourceDef(selectionMode = "single"),
                        "schedules" to DataSourceDef(selectionMode = "single"),
                        "report" to DataSourceDef(selectionMode = "single")
                    )
                )
            )
        }
        val runtime = DataSourceRuntime(
            signals = signals,
            restClient = RestClient(EndpointRegistry(emptyMap())),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val window = WindowContext(
            windowId = "recordWindow",
            metadata = metadata,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val context = runtime.attach(window, "runs")
        signals.selection(WindowIdentity("recordWindow").dataSourceId("schedules")).set(
            SelectionState(selected = mapOf("id" to "sched-1"))
        )
        signals.form(WindowIdentity("recordWindow").windowFormId()).set(
            mapOf("recordId" to listOf(301))
        )

        val resolved = ParameterResolver().resolve(
            listOf(
                ParameterDef(
                    name = "scheduleId",
                    location = "id",
                    from = "schedules:selection",
                    to = ":query"
                ),
                ParameterDef(
                    name = "recordId",
                    location = "recordId.0",
                    from = ":windowForm",
                    to = "report:input.query"
                )
            ),
            context
        )

        assertEquals("sched-1", JsonUtil.asStringMap(JsonUtil.asStringMap(resolved.inbound["runs"])["input"]).let {
            JsonUtil.asStringMap(it["query"])["scheduleId"]
        })
        assertEquals(301, JsonUtil.asStringMap(JsonUtil.asStringMap(resolved.inbound["report"])["input"]).let {
            JsonUtil.asStringMap(it["query"])["recordId"]
        })
    }

    @Test
    fun parameterResolverResolvesLegacyDataSourceInputAndFilterSources() {
        val signals = SignalRegistry()
        val metadata = Signal<WindowMetadata?>(null).also {
            it.set(
                WindowMetadata(
                    dataSources = mapOf(
                        "orders" to DataSourceDef(selectionMode = "single"),
                        "lines" to DataSourceDef(selectionMode = "single")
                    )
                )
            )
        }
        val runtime = DataSourceRuntime(
            signals = signals,
            restClient = RestClient(EndpointRegistry(emptyMap())),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val window = WindowContext(
            windowId = "recordWindow",
            metadata = metadata,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val context = runtime.attach(window, "orders")
        val identity = WindowIdentity("recordWindow")
        signals.selection(identity.dataSourceId("orders")).set(
            SelectionState(selected = mapOf("orderId" to 201, "name" to "Selected order"))
        )
        signals.form(identity.dataSourceId("orders")).set(
            mapOf("orderId" to 301, "status" to "active")
        )
        signals.form(identity.dataSourceId("lines")).set(
            mapOf("lineId" to 401)
        )
        signals.input(identity.dataSourceId("orders")).set(
            InputState(
                filter = mapOf("country" to "US"),
                parameters = mapOf("pageSize" to 25),
                page = 2,
                fetch = true
            )
        )
        signals.input(identity.dataSourceId("lines")).set(
            InputState(
                filter = mapOf("channel" to "CTV"),
                parameters = mapOf("sort" to "name"),
                refresh = true
            )
        )

        val resolved = ParameterResolver().resolveFlat(
            listOf(
                ParameterDef(name = "selectedOrderId", input = "dataSource", location = "orderId"),
                ParameterDef(name = "formStatus", input = "dataSource", location = "status"),
                ParameterDef(name = "lineId", input = "dataSource", location = "lines.lineId"),
                ParameterDef(name = "channel", input = "filter", location = "lines.channel"),
                ParameterDef(name = "pageSize", input = "input", location = "parameters.pageSize"),
                ParameterDef(name = "lineRefresh", input = "input", location = "lines.refresh")
            ),
            context
        )

        assertEquals(201, resolved["selectedOrderId"])
        assertEquals("active", resolved["formStatus"])
        assertEquals(401, resolved["lineId"])
        assertEquals("CTV", resolved["channel"])
        assertEquals(25, resolved["pageSize"])
        assertEquals(true, resolved["lineRefresh"])
    }

    @Test
    fun parameterResolverPreservesExplicitValuesAndSelectors() {
        val signals = SignalRegistry()
        val metadata = Signal<WindowMetadata?>(null).also {
            it.set(WindowMetadata(dataSources = mapOf("report" to DataSourceDef(selectionMode = "single"))))
        }
        val runtime = DataSourceRuntime(
            signals = signals,
            restClient = RestClient(EndpointRegistry(emptyMap())),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val window = WindowContext(
            windowId = "recordWindow",
            metadata = metadata,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val context = runtime.attach(window, "report")
        signals.form(WindowIdentity("recordWindow").windowFormId()).set(
            mapOf(
                "prefill" to mapOf(
                    "scope" to "mobile"
                )
            )
        )

        val resolved = ParameterResolver().resolveFlat(
            listOf(
                ParameterDef(
                    name = "literal",
                    value = JsonUtil.anyToElement(
                        mapOf(
                            "platforms" to listOf("phone", "tablet"),
                            "enabled" to true
                        )
                    )
                ),
                ParameterDef(name = "scope", selector = "prefill.scope")
            ),
            context
        )

        val literal = JsonUtil.asStringMap(resolved["literal"])
        assertEquals(listOf("phone", "tablet"), literal["platforms"])
        assertEquals(true, literal["enabled"])
        assertEquals("mobile", resolved["scope"])
    }

    @Test
    fun parameterResolverCompactRowsSupportSpreadNestedPathsAndMultiSelectionArrays() {
        val signals = SignalRegistry()
        val metadata = Signal<WindowMetadata?>(null).also {
            it.set(
                WindowMetadata(
                    dataSources = mapOf(
                        "report" to DataSourceDef(selectionMode = "single"),
                        "items" to DataSourceDef(selectionMode = "multi")
                    )
                )
            )
        }
        val runtime = DataSourceRuntime(
            signals = signals,
            restClient = RestClient(EndpointRegistry(emptyMap())),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val window = WindowContext(
            windowId = "recordWindow",
            metadata = metadata,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val context = runtime.attach(window, "report")
        val identity = WindowIdentity("recordWindow")
        signals.form(identity.windowFormId()).set(
            mapOf(
                "period" to "today",
                "granularity" to "hour"
            )
        )
        signals.selection(identity.dataSourceId("items")).set(
            SelectionState(
                selection = listOf(
                    mapOf("id" to "item-1", "name" to "One"),
                    mapOf("id" to "item-2", "name" to "Two")
                )
            )
        )

        val resolved = ParameterResolver().resolve(
            listOf(
                ParameterDef(name = "...", from = ":windowForm", to = ":query"),
                ParameterDef(name = "[]itemIds", location = "id", from = "items:selection", to = ":query"),
                ParameterDef(name = "request.options.mode", location = "granularity", from = ":windowForm", to = ":body")
            ),
            context
        )

        val input = JsonUtil.asStringMap(JsonUtil.asStringMap(resolved.inbound["report"])["input"])
        val query = JsonUtil.asStringMap(input["query"])
        val body = JsonUtil.asStringMap(input["body"])
        val request = JsonUtil.asStringMap(body["request"])
        val options = JsonUtil.asStringMap(request["options"])
        assertEquals("today", query["period"])
        assertEquals("hour", query["granularity"])
        assertEquals(listOf("item-1", "item-2"), query["itemIds"])
        assertEquals("hour", options["mode"])
    }
}
