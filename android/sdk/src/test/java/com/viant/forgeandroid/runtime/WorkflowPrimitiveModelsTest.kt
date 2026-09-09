package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class WorkflowPrimitiveModelsTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `presentation primitive contracts decode and round trip`() {
        val source = """
            {
              "id":"record",
              "dataSourceRef":"record",
              "dataStateBoundary":{"dataSourceRefs":["record","summary"],"allowPartial":true,"emptyMessage":"No record","suppressErrorWhen":{"source":"windowForm","field":"sharedError","notEmpty":true},"errorAction":{"label":"Retry records","icon":"refresh","dataSourceRef":"record","bypassCache":true}},
              "relationDrill":{"countField":"childCount","singularLabel":"child","pluralLabel":"children","link":{"windowKey":"children"}},
              "notificationRules":{"rules":[{"id":"missing","intent":"warning","message":"Missing input","visibleWhen":{"source":"form","field":"name","empty":true}}]},
              "metricSummary":{"columns":3,"metrics":[{"id":"spend","label":"Spend","field":"spend","format":"currency2","comparisonField":"delta","betterWhen":"lower"}]},
              "detailView":{"columns":2,"responsiveColumns":{"phone":1},"sections":[{"id":"general","label":"General","fields":[{"id":"name","label":"Name","field":"name","copyable":true}]}]},
              "masterDetail":{"stateKey":"selectedRecord","identityFields":["id"],"master":{"containerId":"list"},"detail":{"containerId":"detail"},"selectionInvalidation":"clear","responsive":{"wide":"split","narrow":"drill"}}
            }
        """.trimIndent()

        val decoded = json.decodeFromString<ContainerDef>(source)
        assertEquals(listOf("record", "summary"), decoded.dataStateBoundary?.dataSourceRefs)
        assertEquals("Retry records", decoded.dataStateBoundary?.errorAction?.label)
        assertTrue(decoded.dataStateBoundary?.errorAction?.bypassCache == true)
        assertEquals("children", decoded.relationDrill?.pluralLabel)
        assertEquals("missing", decoded.notificationRules?.rules?.first()?.id)
        assertEquals("lower", decoded.metricSummary?.metrics?.first()?.betterWhen)
        assertTrue(decoded.detailView?.sections?.first()?.fields?.first()?.copyable == true)
        assertEquals("detail", decoded.masterDetail?.detail?.containerId)

        val roundTrip = json.decodeFromString<ContainerDef>(json.encodeToString(ContainerDef.serializer(), decoded))
        assertEquals(3, roundTrip.metricSummary?.columns)
        assertEquals(1, roundTrip.detailView?.responsiveColumns?.get("phone"))
    }

    @Test
    fun `data boundary distinguishes partial failure`() {
        val state = WorkflowPrimitiveRuntime.dataStateBoundaryKind(
            controls = listOf(ControlState(), ControlState(error = "failed")),
            collections = listOf(listOf(mapOf("id" to 1)), emptyList()),
            allowPartial = true
        )
        assertEquals(DataStateBoundaryKind.Partial, state)
    }

    @Test
    fun `presentation record prefers form`() {
        val record = WorkflowPrimitiveRuntime.presentationRecord(
            form = mapOf("id" to 3),
            collection = listOf(mapOf("id" to 2)),
            metrics = mapOf("id" to 1)
        )
        assertEquals(3, record["id"])
    }

    @Test
    fun `complete primitive catalog decodes and round trips`() {
        val source = """
            {
              "id":"catalog",
              "mutationCommand":{"commandId":"save","dataSourceRef":"writer"},
              "editableCollection":{"identityFields":["id"],"operations":[{"id":"edit","label":"Edit","tooltip":"Requires one row","requiresSelection":true}]},
              "assignmentPicker":{"availableDataSourceRef":"available","assignedDataSourceRef":"assigned"},
              "statusWorkflow":{"stateField":"status","transitions":[{"id":"approve","to":"approved","label":"Approve","command":{"dataSourceRef":"writer"}}]},
              "treeEditor":{"dataSourceRef":"tree","childrenField":"children"},
              "wizard":{"steps":[{"id":"one","label":"One","containerId":"stepOne"}]},
              "uploadCollection":{"accept":["image/*"],"upload":{"dataSourceRef":"upload"}},
              "derivedDataSource":{"sources":["left"],"pipeline":[{"operation":"select","source":"left"}]},
              "permissionBoundary":{"mode":"resource","capability":"read"},
              "responsiveDataGrid":{"identityColumns":["id"],"breakpoints":{"phone":{"columns":["name"],"stickyColumns":[],"columnOverrides":{"name":{"label":"Compact name","width":180}},"rowLayout":"cards","readOnlyCards":true}}},
              "historyDiff":{"beforeField":"before","afterField":"after","redactFields":["secret"]},
              "scheduleEditor":{"startField":"start","endField":"end","timeZoneField":"timeZone"},
              "draftForm":{"dataSourceRef":"draft","submit":{"dataSourceRef":"writer"}},
              "queryToolbar":{"items":[{"id":"filter","type":"filter"}],"density":"compact"},
              "stableTabs":{"defaultSelectedTabId":"one","renderActiveTabPanelOnly":true},
              "resourceHeader":{"titleField":"name","fields":[{"label":"ID","field":"id"}],"actions":[{"id":"watch","label":"Watch"}]}
            }
        """.trimIndent()
        val decoded = json.decodeFromString<ContainerDef>(source)
        assertEquals("save", decoded.mutationCommand?.commandId)
        assertEquals("edit", decoded.editableCollection?.operations?.first()?.id)
        assertEquals("Requires one row", decoded.editableCollection?.operations?.first()?.tooltip)
        assertEquals("approve", decoded.statusWorkflow?.transitions?.first()?.id)
        assertEquals("cards", decoded.responsiveDataGrid?.breakpoints?.get("phone")?.rowLayout)
        assertEquals("Compact name", (decoded.responsiveDataGrid?.breakpoints?.get("phone")?.columnOverrides?.get("name")?.get("label") as? kotlinx.serialization.json.JsonPrimitive)?.content)
        assertEquals("watch", decoded.resourceHeader?.actions?.first()?.id)
        val roundTrip = json.decodeFromString<ContainerDef>(json.encodeToString(ContainerDef.serializer(), decoded))
        assertTrue(roundTrip.responsiveDataGrid?.breakpoints?.get("phone")?.readOnlyCards == true)
        assertEquals("writer", roundTrip.statusWorkflow?.transitions?.first()?.command?.dataSourceRef)
    }

    @Test
    fun `history diff ignores noise and redacts sensitive values`() {
        val entries = WorkflowPrimitiveRuntime.historyDiffEntries(
            before = mapOf("name" to "Old", "secret" to "one", "updatedAt" to "a"),
            after = mapOf("name" to "New", "secret" to "two", "updatedAt" to "b"),
            spec = HistoryDiffSpec(
                beforeField = "before",
                afterField = "after",
                ignoreFields = listOf("updatedAt"),
                fieldLabels = mapOf("name" to "Display name"),
                redactFields = listOf("secret")
            )
        )
        assertEquals(listOf("name", "secret"), entries.map { it.path })
        assertEquals("Display name", entries.first().label)
        assertEquals("••••", entries.last().before)
        assertTrue(entries.last().redacted)
    }

    @Test
    fun `permission boundary fails closed for missing row grant`() {
        val authorization = mapOf("resource" to mapOf("capabilities" to mapOf("read" to true)))
        assertTrue(WorkflowPrimitiveRuntime.permissionAllows(PermissionBoundarySpec(mode = "resource", capability = "read"), authorization))
        assertFalse(WorkflowPrimitiveRuntime.permissionAllows(
            PermissionBoundarySpec(mode = "selection", identityField = "id", capability = "edit"),
            authorization,
            rows = listOf(mapOf("id" to 1), mapOf("id" to 2)),
            grants = listOf(mapOf("resourceId" to 1, "capabilities" to mapOf("edit" to true)))
        ))
    }

    @Test
    fun `derived pipeline joins groups sorts and enforces cardinality`() {
        val spec = DerivedDataSourceSpec(
            maxRows = 20,
            sources = listOf("left", "right"),
            pipeline = listOf(
                DerivedDataStepSpec(operation = "join", source = "right", on = listOf("id"), fields = mapOf("category" to kotlinx.serialization.json.JsonPrimitive("category"))),
                DerivedDataStepSpec(operation = "group", groupBy = listOf("category"), measures = listOf(DerivedMeasureSpec("total", "amount", "sum"))),
                DerivedDataStepSpec(operation = "sort", orderBy = listOf(kotlinx.serialization.json.buildJsonObject { put("columnId", kotlinx.serialization.json.JsonPrimitive("total")); put("direction", kotlinx.serialization.json.JsonPrimitive("desc")) }))
            )
        )
        val rows = DerivedDataSourceRuntime.run(
            mapOf(
                "left" to listOf(mapOf("id" to 1, "amount" to 3), mapOf("id" to 2, "amount" to 8)),
                "right" to listOf(mapOf("id" to 1, "category" to "A"), mapOf("id" to 2, "category" to "B"))
            ),
            spec
        )
        assertEquals(listOf("B", "A"), rows.map { it["category"] })
        assertEquals(8.0, rows.first()["total"])
        kotlin.test.assertFails {
            DerivedDataSourceRuntime.run(
                mapOf("left" to listOf(mapOf("id" to 1)), "right" to listOf(mapOf("id" to 1), mapOf("id" to 1))),
                spec
            )
        }
    }

    @Test
    fun `responsive grid falls back from phone to narrow then desktop`() {
        val spec = ResponsiveDataGridSpec(
            breakpoints = mapOf(
                "narrow" to ResponsiveDataGridStateSpec(columns = listOf("name"), rowLayout = "cards"),
                "desktop" to ResponsiveDataGridStateSpec(columns = listOf("id", "name"), rowLayout = "table")
            )
        )
        assertEquals(listOf("name"), WorkflowPrimitiveRuntime.responsiveDataGridState(spec, "phone")?.columns)
        assertEquals(listOf("id", "name"), WorkflowPrimitiveRuntime.responsiveDataGridState(spec, "tablet")?.columns)
    }

    @Test
    fun `schedule validation covers range duration overlap and timezone errors`() {
        val result = WorkflowPrimitiveRuntime.validateSchedule(
            listOf(
                mapOf("start" to "2026-09-08T10:00:00Z", "end" to "2026-09-08T11:00:00Z"),
                mapOf("start" to "2026-09-08T10:30:00Z", "end" to "2026-09-08T10:40:00Z"),
                mapOf("start" to "bad", "end" to "2026-09-08T12:00:00Z", "_scheduleErrors" to mapOf("start" to "DST gap"))
            ),
            ScheduleEditorSpec(startField = "start", endField = "end", allowOverlap = false, minDuration = "30m")
        )
        assertFalse(result.valid)
        assertTrue(ScheduleValidationError(1, "min_duration") in result.errors)
        assertTrue(ScheduleValidationError(1, "overlap") in result.errors)
        assertTrue(ScheduleValidationError(2, "invalid_date") in result.errors)
        assertTrue(ScheduleValidationError(2, "timezone") in result.errors)
    }

    @Test
    fun `tree selection cascades to descendants`() {
        val nodes = listOf(mapOf("id" to "root", "children" to listOf(mapOf("id" to "a"), mapOf("id" to "b", "children" to listOf(mapOf("id" to "c"))))))
        val spec = TreeEditorSpec(childrenField = "children", identityField = "id", cascade = "descendants")
        val selected = WorkflowPrimitiveRuntime.toggleTreeSelection(nodes, emptySet(), "root", true, spec)
        assertEquals(setOf("root", "a", "b", "c"), selected)
        assertTrue(WorkflowPrimitiveRuntime.toggleTreeSelection(nodes, selected, "b", false, spec).intersect(setOf("b", "c")).isEmpty())
    }

    @Test
    fun `upload validation and MCP blob encoding use actual bytes`() {
        val spec = UploadCollectionSpec(
            accept = listOf("image/*", ".txt"), multiple = true, maxFiles = 2, maxBytes = 4,
            transport = "mcpBlob", blobField = "attachments",
            upload = MutationCommandDef(dataSourceRef = "upload")
        )
        val files = listOf(UploadFileValue("a.txt", "text/plain", byteArrayOf(0, 1, 2)))
        assertTrue(WorkflowPrimitiveRuntime.validateUpload(files, spec).valid)
        val payload = WorkflowPrimitiveRuntime.encodeUpload(files, spec)
        val blob = (payload["attachments"] as List<*>).first() as Map<*, *>
        assertEquals("a.txt", blob["filename"])
        assertEquals("AAEC", blob["data"])
        assertFalse(WorkflowPrimitiveRuntime.validateUpload(listOf(UploadFileValue("large.png", "image/png", ByteArray(5))), spec).valid)
    }

    @Test
    fun `master detail restores by identity and builds typed parameters`() {
        val rows = listOf(mapOf("id" to 1, "name" to "One"), mapOf("id" to 2, "name" to "Two"))
        val restored = WorkflowPrimitiveRuntime.resolveMasterDetailSelection(rows, null, mapOf("id" to 2), listOf("id"))
        assertEquals("Two", restored?.get("name"))
        val region = MasterDetailRegionSpec(
            containerId = "detail",
            parameters = mapOf("RecordId" to kotlinx.serialization.json.buildJsonObject {
                put("source", kotlinx.serialization.json.JsonPrimitive("row")); put("selector", kotlinx.serialization.json.JsonPrimitive("id")); put("wrap", kotlinx.serialization.json.JsonPrimitive("array"))
            })
        )
        assertEquals(listOf(2), WorkflowPrimitiveRuntime.masterDetailParameters(region, restored.orEmpty())["RecordId"])
        assertEquals(null, WorkflowPrimitiveRuntime.resolveMasterDetailSelection(rows, null, mapOf("id" to 3), listOf("id")))
    }

    @Test
    fun `resource model unmarshals validates and marshals changed payload`() = kotlinx.coroutines.runBlocking {
        val metadata = json.decodeFromString<WindowMetadata>(
            """{"schemas":{"record":{"type":"object","identity":["id"],"required":["id","name"],"additionalProperties":false,"properties":{"id":{"type":"integer"},"name":{"type":"string","minLength":1},"cap":{"type":"integer","nullable":true}}}},"resourceModels":{"record":{"schemaRef":"record","read":{"dataSourceRef":"record_read"},"write":{"dataSourceRef":"record_patch","inputPath":"Records","mode":"changed"},"fields":{"id":{"read":"id","write":"Id","codec":"integer"},"name":{"read":"display_name","write":"Name","codec":"string","trim":true},"cap":{"read":"daily_cap","write":"DailyCap","codec":"integer","empty":"null"}}}}}"""
        )
        val canonical = ResourceModelRuntime.unmarshal(
            mapOf("id" to 1, "display_name" to " Old ", "daily_cap" to ""),
            "record", metadata.schemas, metadata.resourceModels
        ) as Map<*, *>
        assertEquals("Old", canonical["name"])
        assertEquals(null, canonical["cap"])
        val payload = ResourceModelRuntime.marshal(
            mapOf("id" to 1, "name" to "New", "cap" to null),
            mapOf("id" to 1, "name" to "Old", "cap" to null),
            "record", schemas = metadata.schemas, models = metadata.resourceModels
        )
        val record = payload["Records"] as Map<*, *>
        assertEquals(1L, record["Id"])
        assertEquals("New", record["Name"])
        assertFalse(record.containsKey("DailyCap"))
        kotlin.test.assertFails {
            ResourceModelRuntime.marshal(
                mapOf("id" to 2, "name" to "New"), mapOf("id" to 1, "name" to "Old"),
                "record", schemas = metadata.schemas, models = metadata.resourceModels
            )
        }
        Unit
    }

    @Test
    fun `resource model hooks and nested collection semantics`() = kotlinx.coroutines.runBlocking {
        val metadata = json.decodeFromString<WindowMetadata>(
            """{"schemas":{"root":{"type":"object","identity":["id"],"required":["id","name"],"properties":{"id":{"type":"integer"},"name":{"type":"string"},"rows":{"type":"array","items":{"${'$'}ref":"row"}}}},"row":{"type":"object","identity":["id"],"required":["id","clientKey"],"properties":{"id":{"type":"integer"},"clientKey":{"type":"string"},"value":{"type":"integer"}}}},"resourceModels":{"root":{"schemaRef":"root","write":{"inputPath":"Root","mode":"overlayBaseline"},"hooks":{"beforeUnmarshal":"beforeRead","afterUnmarshal":"afterRead","beforeMarshal":"beforeWrite","afterMarshal":"afterWrite"},"fields":{"id":{"write":"Id"},"name":{"write":"Name"},"rows":{"write":"Rows","collection":{"modelRef":"row","identity":["id"],"clientKey":"clientKey","mode":"merge","preserveOrder":false}}}},"row":{"schemaRef":"row","fields":{"id":{"write":"Id"},"clientKey":{"write":"-"},"value":{"write":"Value"}}}}}"""
        )
        val hook: ResourceModelHook = { name, value ->
            val result = JsonUtil.asStringMap(value).toMutableMap()
            when (name) {
                "beforeRead" -> result["name"] = "before"
                "afterRead" -> result["name"] = "after"
                "beforeWrite" -> result["name"] = "hooked"
                "afterWrite" -> result["Name"] = "done"
            }
            result
        }
        val read = ResourceModelRuntime.unmarshal(mapOf("id" to 1, "name" to "raw"), "root", metadata.schemas, metadata.resourceModels, hook) as Map<*, *>
        assertEquals("after", read["name"])
        val baseline = mapOf("id" to 1, "name" to "old", "rows" to listOf(
            mapOf("id" to 11, "clientKey" to "a", "value" to 1), mapOf("id" to 12, "clientKey" to "b", "value" to 2)
        ))
        val payload = ResourceModelRuntime.marshal(mapOf("id" to 1, "name" to "new", "rows" to listOf(
            mapOf("id" to 12, "clientKey" to "b", "value" to 20), mapOf("id" to 11, "clientKey" to "a", "value" to 10),
            mapOf("id" to 0, "clientKey" to "new-a", "value" to 30), mapOf("id" to 0, "clientKey" to "new-b", "value" to 40)
        )), baseline, "root", schemas = metadata.schemas, models = metadata.resourceModels, hook = hook)
        val root = payload["Root"] as Map<*, *>
        assertEquals("done", root["Name"])
        val rows = root["Rows"] as List<*>
        assertEquals(listOf(11, 12, 0, 0), rows.map { (it as Map<*, *>)["Id"] })
        assertTrue(rows.all { !(it as Map<*, *>).containsKey("clientKey") })
        kotlin.test.assertFails {
            ResourceModelRuntime.marshal(mapOf("id" to 1, "name" to "new", "rows" to listOf(
                mapOf("id" to 0, "clientKey" to "same", "value" to 1), mapOf("id" to 0, "clientKey" to "same", "value" to 2)
            )), baseline, "root", schemas = metadata.schemas, models = metadata.resourceModels)
        }
        val identityChangingHook: ResourceModelHook = { name, value ->
            if (name != "beforeWrite") value else JsonUtil.asStringMap(value).toMutableMap().also { it["id"] = 2 }
        }
        kotlin.test.assertFails {
            ResourceModelRuntime.marshal(mapOf("id" to 1, "name" to "new"), baseline, "root", schemas = metadata.schemas, models = metadata.resourceModels, hook = identityChangingHook)
        }
        Unit
    }
}
