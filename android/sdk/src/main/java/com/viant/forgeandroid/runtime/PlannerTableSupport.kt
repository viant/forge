package com.viant.forgeandroid.runtime

enum class PlannerTableSubmitStatus {
    Idle,
    Submitting,
    Submitted,
    Failure
}

data class PlannerTableSubmitFeedback(
    val buttonLabel: String,
    val message: String? = null,
    val busy: Boolean = false
)

fun plannerTableSelectionField(table: TableDef): String =
    table.selectionField?.trim()?.takeIf { it.isNotEmpty() } ?: "selected"

fun plannerTableDisabledField(table: TableDef): String =
    table.disabledField?.trim()?.takeIf { it.isNotEmpty() } ?: "disabled"

fun plannerTableDefaultSelectedIndexes(
    rows: List<Map<String, Any?>>,
    selectionField: String,
    disabledField: String
): Set<Int> {
    return rows.mapIndexedNotNull { index, row ->
        if (plannerTableRowDisabled(row, disabledField)) {
            null
        } else if (plannerTableBool(row[selectionField]) == false) {
            null
        } else {
            index
        }
    }.toSet()
}

fun plannerTableRowsWithSelection(
    rows: List<Map<String, Any?>>,
    selectedRowIndexes: Set<Int>,
    selectionField: String
): List<Map<String, Any?>> {
    return rows.mapIndexed { index, row ->
        row + (selectionField to selectedRowIndexes.contains(index))
    }
}

fun plannerTableSelectableRowCount(rows: List<Map<String, Any?>>, disabledField: String): Int =
    rows.count { !plannerTableRowDisabled(it, disabledField) }

fun plannerTableSubmitFeedback(
    status: PlannerTableSubmitStatus,
    selectedCount: Int = 0,
    selectableCount: Int = 0,
    failureMessage: String? = null
): PlannerTableSubmitFeedback {
    return when (status) {
        PlannerTableSubmitStatus.Idle -> PlannerTableSubmitFeedback(buttonLabel = "Submit")
        PlannerTableSubmitStatus.Submitting -> PlannerTableSubmitFeedback(
            buttonLabel = "Submitting...",
            message = plannerTableSelectionSummary("Submitting", selectedCount, selectableCount),
            busy = true
        )
        PlannerTableSubmitStatus.Submitted -> PlannerTableSubmitFeedback(
            buttonLabel = "Submitted",
            message = plannerTableSelectionSummary("Submitted", selectedCount, selectableCount)
        )
        PlannerTableSubmitStatus.Failure -> PlannerTableSubmitFeedback(
            buttonLabel = "Retry",
            message = failureMessage?.trim()?.takeIf { it.isNotEmpty() } ?: "Submit action failed."
        )
    }
}

fun plannerTableCallbackPayload(
    table: TableDef,
    dataSourceRef: String,
    rows: List<Map<String, Any?>>,
    selectedRowIndexes: Set<Int>
): Map<String, Any?> {
    val selectionField = plannerTableSelectionField(table)
    val disabledField = plannerTableDisabledField(table)
    val rowsWithSelection = plannerTableRowsWithSelection(rows, selectedRowIndexes, selectionField)
    val disabledRows = rowsWithSelection.filter { plannerTableRowDisabled(it, disabledField) }
    val activeRows = rowsWithSelection.filterNot { plannerTableRowDisabled(it, disabledField) }
    return mapOf(
        "callback" to table.callback?.let(JsonUtil::elementToAny),
        "dataSourceRef" to dataSourceRef,
        "selectedRows" to activeRows.filter { plannerTableBool(it[selectionField]) == true },
        "unselectedRows" to activeRows.filterNot { plannerTableBool(it[selectionField]) == true },
        "disabledRows" to disabledRows,
        "selectionField" to selectionField
    )
}

fun plannerTableCsv(
    columns: List<ColumnDef>,
    rows: List<Map<String, Any?>>,
    selectionField: String
): String {
    val exportColumns = if (columns.any { plannerTableColumnKey(it) == selectionField }) {
        columns
    } else {
        columns + ColumnDef(id = selectionField, name = selectionField, label = selectionField)
    }
    val header = exportColumns.joinToString(",") {
        plannerCsvCell(it.label ?: it.name ?: it.id ?: it.key ?: "")
    }
    val body = rows.joinToString("\n") { row ->
        exportColumns.joinToString(",") { column ->
            plannerCsvCell(row[plannerTableColumnKey(column)].plannerDisplayString())
        }
    }
    return listOf(header, body).filter { it.isNotEmpty() }.joinToString("\n")
}

fun plannerTableRowDisabled(row: Map<String, Any?>, disabledField: String): Boolean {
    if (plannerTableBool(row[disabledField]) == true) {
        return true
    }
    if (disabledField != "disabled" && plannerTableBool(row["disabled"]) == true) {
        return true
    }
    return plannerTableBool(row["isDisabled"]) == true
}

fun plannerTableColumnKey(column: ColumnDef): String =
    column.id?.takeIf { it.isNotBlank() }
        ?: column.name?.takeIf { it.isNotBlank() }
        ?: column.key?.takeIf { it.isNotBlank() }
        ?: column.label.orEmpty()

private fun plannerTableBool(value: Any?): Boolean? {
    return when (value) {
        is Boolean -> value
        is Number -> value.toDouble() != 0.0
        is String -> when (value.trim().lowercase()) {
            "true", "yes", "1", "selected", "enabled" -> true
            "false", "no", "0", "unselected", "disabled" -> false
            else -> null
        }
        else -> null
    }
}

private fun plannerTableSelectionSummary(prefix: String, selectedCount: Int, selectableCount: Int): String {
    val boundedSelected = selectedCount.coerceAtLeast(0)
    val boundedSelectable = selectableCount.coerceAtLeast(0)
    return if (boundedSelectable > 0) {
        val rowLabel = if (boundedSelectable == 1) "row" else "rows"
        "$prefix $boundedSelected of $boundedSelectable selectable $rowLabel."
    } else {
        val rowLabel = if (boundedSelected == 1) "row" else "rows"
        "$prefix $boundedSelected selected $rowLabel."
    }
}

private fun Any?.plannerDisplayString(): String {
    return when (this) {
        null -> ""
        is Boolean -> if (this) "true" else "false"
        is Iterable<*> -> joinToString(", ") { it.plannerDisplayString() }
        is Map<*, *> -> entries.joinToString(", ") { "${it.key}: ${it.value.plannerDisplayString()}" }
        else -> toString()
    }
}

private fun plannerCsvCell(value: String): String {
    return if (value.any { it == '"' || it == ',' || it == '\n' || it == '\r' }) {
        "\"${value.replace("\"", "\"\"")}\""
    } else {
        value
    }
}
