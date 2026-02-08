package com.viant.forgeandroid.runtime

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class WindowMetadata(
    val namespace: String? = null,
    val view: ViewDef? = null,
    @SerialName("dataSource")
    val dataSources: Map<String, DataSourceDef> = emptyMap(),
    val dialogs: List<DialogDef> = emptyList(),
    val window: WindowDef? = null,
    val actions: ActionsDef? = null,
    val on: List<ExecutionDef> = emptyList()
)

@Serializable
data class ActionsDef(
    val code: String? = null
)

@Serializable
data class WindowDef(
    val on: List<ExecutionDef> = emptyList(),
    val footer: FooterDef? = null
)

@Serializable
data class FooterDef(
    val hide: Boolean? = null
)

@Serializable
data class ViewDef(
    val content: ContentDef? = null
)

@Serializable
data class ContentDef(
    val containers: List<ContainerDef> = emptyList()
)

@Serializable
data class ContainerDef(
    val id: String? = null,
    val title: String? = null,
    val dataSourceRef: String? = null,
    val table: TableDef? = null,
    val items: List<ItemDef> = emptyList(),
    val containers: List<ContainerDef> = emptyList(),
    val tabs: TabsDef? = null,
    val layout: LayoutDef? = null,
    val chat: ChatDef? = null
)

@Serializable
data class TabsDef(
    val vertical: Boolean? = null
)

@Serializable
data class LayoutDef(
    val labelPosition: String? = null
)

@Serializable
data class TableDef(
    val columns: List<ColumnDef> = emptyList(),
    val toolbar: ToolbarDef? = null,
    val on: List<ExecutionDef> = emptyList()
)

@Serializable
data class ToolbarDef(
    val items: List<ToolbarItemDef> = emptyList()
)

@Serializable
data class ToolbarItemDef(
    val id: String? = null,
    val icon: String? = null,
    val align: String? = null,
    val on: List<ExecutionDef> = emptyList()
)

@Serializable
data class ColumnDef(
    val id: String? = null,
    val name: String? = null,
    val label: String? = null,
    val type: String? = null,
    val width: Int? = null,
    val icon: String? = null,
    val on: List<ExecutionDef> = emptyList()
)

@Serializable
data class ItemDef(
    val id: String? = null,
    val label: String? = null,
    val type: String? = null,
    val dataField: String? = null,
    val bindingPath: String? = null,
    val scope: String? = null,
    val options: List<OptionDef> = emptyList(),
    val properties: Map<String, JsonElement> = emptyMap(),
    val on: List<ExecutionDef> = emptyList()
)

@Serializable
data class OptionDef(
    val value: String? = null,
    val label: String? = null
)

@Serializable
data class DialogDef(
    val id: String? = null,
    val title: String? = null,
    val content: ContainerDef? = null,
    val on: List<ExecutionDef> = emptyList(),
    val actions: List<ActionDef> = emptyList(),
    val style: Map<String, String> = emptyMap()
)

@Serializable
data class ActionDef(
    val id: String? = null,
    val label: String? = null,
    val icon: String? = null,
    val on: List<ExecutionDef> = emptyList()
)

@Serializable
data class DataSourceDef(
    val service: ServiceDef? = null,
    val selectionMode: String? = null,
    val uniqueKey: List<UniqueKeyDef> = emptyList(),
    val selectors: SelectorDef? = null,
    val paging: PagingDef? = null,
    val parameters: List<ParameterDef> = emptyList()
)

@Serializable
data class ServiceDef(
    val endpoint: String? = null,
    val uri: String? = null,
    val method: String? = null
)

@Serializable
data class UniqueKeyDef(
    val field: String? = null,
    val parameter: String? = null
)

@Serializable
data class SelectorDef(
    val data: String? = null,
    val dataInfo: String? = null,
    val metrics: String? = null
)

@Serializable
data class PagingDef(
    val size: Int? = null,
    val enabled: Boolean? = null,
    val parameters: Map<String, String> = emptyMap(),
    val dataInfoSelectors: Map<String, String> = emptyMap()
)

@Serializable
data class ExecutionDef(
    val event: String? = null,
    val handler: String? = null,
    val args: List<String> = emptyList(),
    val parameters: List<ParameterDef> = emptyList(),
    val init: String? = null,
    val onError: String? = null,
    val onDone: String? = null,
    val onSuccess: String? = null,
    val async: Boolean? = null
)

@Serializable
data class ParameterDef(
    val name: String? = null,
    val kind: String? = null,
    @SerialName("in") val input: String? = null,
    val location: String? = null,
    val from: String? = null,
    val to: String? = null,
    val direction: String? = null,
    val output: Boolean? = null
)

@Serializable
data class ChatDef(
    val on: List<ExecutionDef> = emptyList(),
    val header: ChatHeaderDef? = null
)

@Serializable
data class ChatHeaderDef(
    val title: String? = null,
    val left: List<ChatHeaderButtonDef> = emptyList(),
    val right: List<ChatHeaderButtonDef> = emptyList()
)

@Serializable
data class ChatHeaderButtonDef(
    val icon: String? = null,
    val label: String? = null,
    val on: List<ExecutionDef> = emptyList()
)

// Runtime state containers

data class WindowState(
    val windowId: String,
    val windowKey: String,
    val windowTitle: String,
    val inTab: Boolean = true,
    val parameters: Map<String, Any?> = emptyMap(),
    val inlineMetadata: WindowMetadata? = null,
    val isModal: Boolean = false
)

data class SelectionState(
    val selected: Map<String, Any?>? = null,
    val selection: List<Map<String, Any?>> = emptyList(),
    val rowIndex: Int = -1
)

data class InputState(
    val filter: Map<String, Any?> = emptyMap(),
    val parameters: Map<String, Any?> = emptyMap(),
    val page: Int? = null,
    val fetch: Boolean = false,
    val refresh: Boolean = false
)

data class ControlState(
    val loading: Boolean = false,
    val error: String? = null,
    val inactive: Boolean = false
)

data class DialogState(
    val open: Boolean = false,
    val props: Map<String, Any?> = emptyMap(),
    val args: Map<String, Any?> = emptyMap()
)
