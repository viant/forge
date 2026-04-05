package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun MarkdownRenderer(markdown: String, modifier: Modifier = Modifier) {
    val blocks = rememberMarkdownBlocks(markdown)
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        blocks.forEach { block ->
            when (block.type) {
                MarkdownBlockType.Heading -> Text(
                    text = block.text,
                    style = when (block.level) {
                        1 -> MaterialTheme.typography.headlineSmall
                        2 -> MaterialTheme.typography.titleLarge
                        else -> MaterialTheme.typography.titleMedium
                    },
                    fontWeight = FontWeight.SemiBold
                )

                MarkdownBlockType.Bullet -> Text(
                    text = "\u2022 ${block.text}",
                    style = MaterialTheme.typography.bodyMedium
                )

                MarkdownBlockType.Numbered -> Text(
                    text = "${block.marker} ${block.text}",
                    style = MaterialTheme.typography.bodyMedium
                )

                MarkdownBlockType.Quote -> Text(
                    text = block.text,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF7F8FA), RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                )

                MarkdownBlockType.Code -> Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF6F8FB), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val fence = describeFence(block.meta, block.text)
                    when (fence.renderer) {
                        FenceRendererType.Mermaid -> MermaidRenderer(fence.body)
                        FenceRendererType.Markdown -> MarkdownRenderer(fence.body)
                        FenceRendererType.PipeTable -> fence.table?.let { table ->
                            MarkdownTable(
                                MarkdownBlock(
                                    type = MarkdownBlockType.Table,
                                    text = "",
                                    cells = buildList {
                                        add(table.headers)
                                        add(List(table.headers.size) { "---" })
                                        addAll(table.rows)
                                    }
                                )
                            )
                        } ?: FallbackCodeBlock(fence.lang, fence.body)
                        FenceRendererType.Chart -> fence.chart?.let { FenceChartRenderer(it) } ?: FallbackCodeBlock(fence.lang, fence.body)
                        FenceRendererType.Code -> FallbackCodeBlock(fence.lang, fence.body)
                    }
                }

                MarkdownBlockType.Table -> MarkdownTable(block)

                MarkdownBlockType.Paragraph -> Text(
                    text = block.text,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

@Composable
private fun FallbackCodeBlock(lang: String, body: String) {
    if (lang.isNotBlank()) {
        Text(
            text = lang.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = Color(0xFF667085)
        )
    }
    Box(modifier = Modifier.horizontalScroll(rememberScrollState())) {
        Text(
            text = body,
            style = MaterialTheme.typography.bodySmall,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
private fun rememberMarkdownBlocks(markdown: String): List<MarkdownBlock> {
    return parseMarkdown(markdown)
}

private enum class MarkdownBlockType { Heading, Paragraph, Bullet, Numbered, Quote, Code, Table }

private data class MarkdownBlock(
    val type: MarkdownBlockType,
    val text: String,
    val level: Int = 0,
    val marker: String = "",
    val meta: String = "",
    val cells: List<List<String>> = emptyList()
)

private fun parseMarkdown(markdown: String): List<MarkdownBlock> {
    if (markdown.isBlank()) return emptyList()
    val blocks = mutableListOf<MarkdownBlock>()
    val lines = markdown.replace("\r\n", "\n").split('\n')
    val paragraph = StringBuilder()
    var inCode = false
    var codeLanguage = ""
    val code = StringBuilder()
    var tableRows = mutableListOf<List<String>>()

    fun flushParagraph() {
        val text = paragraph.toString().trim()
        if (text.isNotEmpty()) {
            blocks += MarkdownBlock(MarkdownBlockType.Paragraph, inlineMarkdown(text))
        }
        paragraph.clear()
    }

    fun flushTable() {
        if (tableRows.isNotEmpty()) {
            blocks += MarkdownBlock(
                type = MarkdownBlockType.Table,
                text = "",
                cells = tableRows.toList()
            )
            tableRows = mutableListOf()
        }
    }

    lines.forEach { raw ->
        val line = raw.trimEnd()
        if (line.startsWith("```")) {
            flushParagraph()
            flushTable()
            if (inCode) {
                val text = code.toString().trimEnd()
                if (text.isNotEmpty()) {
                    blocks += MarkdownBlock(MarkdownBlockType.Code, text, meta = codeLanguage)
                }
                code.clear()
                codeLanguage = ""
            } else {
                codeLanguage = line.removePrefix("```").trim()
            }
            inCode = !inCode
            return@forEach
        }
        if (inCode) {
            code.appendLine(raw)
            return@forEach
        }
        val trimmed = line.trim()
        if (trimmed.isBlank()) {
            flushParagraph()
            flushTable()
            return@forEach
        }
        if (isTableRow(trimmed)) {
            flushParagraph()
            tableRows += parseTableRow(trimmed)
            return@forEach
        }
        flushTable()
        when {
            trimmed.startsWith("# ") -> {
                flushParagraph()
                blocks += MarkdownBlock(MarkdownBlockType.Heading, inlineMarkdown(trimmed.removePrefix("# ").trim()), 1)
            }
            trimmed.startsWith("## ") -> {
                flushParagraph()
                blocks += MarkdownBlock(MarkdownBlockType.Heading, inlineMarkdown(trimmed.removePrefix("## ").trim()), 2)
            }
            trimmed.startsWith("### ") -> {
                flushParagraph()
                blocks += MarkdownBlock(MarkdownBlockType.Heading, inlineMarkdown(trimmed.removePrefix("### ").trim()), 3)
            }
            trimmed.startsWith("- ") || trimmed.startsWith("* ") -> {
                flushParagraph()
                blocks += MarkdownBlock(MarkdownBlockType.Bullet, inlineMarkdown(trimmed.drop(2).trim()))
            }
            Regex("^\\d+\\.\\s+").containsMatchIn(trimmed) -> {
                flushParagraph()
                val marker = trimmed.substringBefore(' ').trim()
                val body = trimmed.substringAfter(' ').trim()
                blocks += MarkdownBlock(MarkdownBlockType.Numbered, inlineMarkdown(body), marker = marker)
            }
            trimmed.startsWith("> ") -> {
                flushParagraph()
                blocks += MarkdownBlock(MarkdownBlockType.Quote, inlineMarkdown(trimmed.removePrefix("> ").trim()))
            }
            else -> {
                if (paragraph.isNotEmpty()) paragraph.append(' ')
                paragraph.append(trimmed)
            }
        }
    }

    if (inCode) {
        val text = code.toString().trimEnd()
        if (text.isNotEmpty()) {
            blocks += MarkdownBlock(MarkdownBlockType.Code, text, meta = codeLanguage)
        }
    }
    flushTable()
    flushParagraph()
    return blocks
}

private fun inlineMarkdown(text: String): String {
    return text
        .replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
        .replace(Regex("`(.+?)`"), "$1")
        .replace(Regex("\\[(.+?)]\\((.+?)\\)"), "$1")
}

@Composable
private fun MermaidRenderer(source: String) {
    val diagram = parseMermaidDiagram(source)
    if (diagram == null) {
        Text(
            text = "MERMAID",
            style = MaterialTheme.typography.labelSmall,
            color = Color(0xFF667085)
        )
        Box(modifier = Modifier.horizontalScroll(rememberScrollState())) {
            Text(
                text = source,
                style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace
            )
        }
        return
    }
    Text(
        text = "MERMAID",
        style = MaterialTheme.typography.labelSmall,
        color = Color(0xFF667085)
    )
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFFBFCFE), RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        when (diagram) {
            is MermaidDiagram.Flowchart -> {
                diagram.nodes.forEachIndexed { index, node ->
                    MermaidNode(node)
                    if (index < diagram.nodes.lastIndex) {
                        Text(
                            text = "↓",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color(0xFF6B7280),
                            modifier = Modifier.padding(start = 16.dp)
                        )
                    }
                }
            }

            is MermaidDiagram.Sequence -> {
                if (diagram.actors.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        diagram.actors.forEach { actor ->
                            Box(
                                modifier = Modifier
                                    .background(Color.White, RoundedCornerShape(999.dp))
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = actor,
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
                diagram.messages.forEach { message ->
                    MermaidSequenceMessage(message)
                }
            }

            is MermaidDiagram.ClassDiagram -> {
                diagram.classes.forEach { klass ->
                    MermaidClassCard(klass)
                }
                diagram.relations.forEach { relation ->
                    MermaidRelationLine(relation.from, relation.to, relation.label)
                }
            }

            is MermaidDiagram.StateDiagram -> {
                diagram.states.forEachIndexed { index, state ->
                    MermaidNode(state)
                    if (index < diagram.states.lastIndex) {
                        Text(
                            text = "↓",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color(0xFF6B7280),
                            modifier = Modifier.padding(start = 16.dp)
                        )
                    }
                }
                diagram.transitions.forEach { transition ->
                    MermaidRelationLine(transition.from, transition.to, transition.label)
                }
            }
        }
    }
}

@Composable
private fun MermaidNode(label: String) {
    Text(
        text = label,
        style = MaterialTheme.typography.bodyMedium,
        fontWeight = FontWeight.Medium,
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp)
    )
}

@Composable
private fun MermaidSequenceMessage(message: MermaidSequenceMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = message.from,
            style = MaterialTheme.typography.labelMedium,
            color = Color(0xFF475467),
            modifier = Modifier.weight(1f, fill = false)
        )
        Text(
            text = "→",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF6B7280)
        )
        Text(
            text = message.to,
            style = MaterialTheme.typography.labelMedium,
            color = Color(0xFF475467),
            modifier = Modifier.weight(1f, fill = false)
        )
    }
    Text(
        text = message.text,
        style = MaterialTheme.typography.bodySmall,
        color = Color(0xFF101828),
        modifier = Modifier.padding(start = 8.dp)
    )
}

@Composable
private fun MermaidClassCard(klass: MermaidClass) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = klass.name,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold
        )
        klass.members.forEach { member ->
            Text(
                text = member,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF475467)
            )
        }
    }
}

@Composable
private fun MermaidRelationLine(from: String, to: String, label: String?) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = from,
            style = MaterialTheme.typography.labelMedium,
            color = Color(0xFF475467),
            modifier = Modifier.weight(1f, fill = false)
        )
        Text(
            text = "→",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF6B7280)
        )
        Text(
            text = to,
            style = MaterialTheme.typography.labelMedium,
            color = Color(0xFF475467),
            modifier = Modifier.weight(1f, fill = false)
        )
    }
    label?.takeIf { it.isNotBlank() }?.let {
        Text(
            text = it,
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF101828),
            modifier = Modifier.padding(start = 8.dp)
        )
    }
}

internal sealed interface MermaidDiagram {
    data class Flowchart(val nodes: List<String>) : MermaidDiagram
    data class Sequence(
        val actors: List<String>,
        val messages: List<MermaidSequenceMessage>
    ) : MermaidDiagram
    data class ClassDiagram(
        val classes: List<MermaidClass>,
        val relations: List<MermaidRelation>
    ) : MermaidDiagram
    data class StateDiagram(
        val states: List<String>,
        val transitions: List<MermaidRelation>
    ) : MermaidDiagram
}

internal data class MermaidSequenceMessage(
    val from: String,
    val to: String,
    val text: String
)

internal data class MermaidClass(
    val name: String,
    val members: List<String>
)

internal data class MermaidRelation(
    val from: String,
    val to: String,
    val label: String? = null
)

internal fun parseMermaidDiagram(source: String): MermaidDiagram? {
    return parseMermaidFlowchart(source)
        ?: parseMermaidSequence(source)
        ?: parseMermaidClassDiagram(source)
        ?: parseMermaidStateDiagram(source)
}

private fun parseMermaidFlowchart(source: String): MermaidDiagram.Flowchart? {
    val lines = source.lines().map { it.trim() }.filter { it.isNotBlank() }
    if (lines.isEmpty()) return null
    val header = lines.first().lowercase()
    if (!header.startsWith("flowchart") && !header.startsWith("graph")) {
        return null
    }
    val nodeLabels = linkedMapOf<String, String>()
    val edgeRegex = Regex("""^([A-Za-z0-9_]+)(?:\[(.+?)])?\s*-->\s*([A-Za-z0-9_]+)(?:\[(.+?)])?$""")
    lines.drop(1).forEach { line ->
        val match = edgeRegex.matchEntire(line) ?: return@forEach
        val fromId = match.groupValues[1]
        val fromLabel = match.groupValues[2].ifBlank { fromId }
        val toId = match.groupValues[3]
        val toLabel = match.groupValues[4].ifBlank { toId }
        nodeLabels.putIfAbsent(fromId, fromLabel)
        nodeLabels.putIfAbsent(toId, toLabel)
    }
    if (nodeLabels.isEmpty()) return null
    return MermaidDiagram.Flowchart(nodeLabels.values.toList())
}

private fun parseMermaidSequence(source: String): MermaidDiagram.Sequence? {
    val lines = source.lines().map { it.trim() }.filter { it.isNotBlank() }
    if (lines.isEmpty()) return null
    val header = lines.first().lowercase()
    if (!header.startsWith("sequencediagram")) {
        return null
    }
    val actorLabels = linkedMapOf<String, String>()
    val messages = mutableListOf<MermaidSequenceMessage>()
    val participantRegex = Regex("""^(participant|actor)\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?$""", RegexOption.IGNORE_CASE)
    val messageRegex = Regex("""^([A-Za-z0-9_]+)\s*[-.=x]+>{1,2}\s*([A-Za-z0-9_]+)\s*:\s*(.+)$""")

    lines.drop(1).forEach { line ->
        participantRegex.matchEntire(line)?.let { match ->
            val id = match.groupValues[2]
            val label = match.groupValues[3].ifBlank { id }.trim()
            actorLabels.putIfAbsent(id, label)
            return@forEach
        }
        messageRegex.matchEntire(line)?.let { match ->
            val fromId = match.groupValues[1]
            val toId = match.groupValues[2]
            val text = match.groupValues[3].trim()
            actorLabels.putIfAbsent(fromId, fromId)
            actorLabels.putIfAbsent(toId, toId)
            messages += MermaidSequenceMessage(
                from = actorLabels[fromId].orEmpty(),
                to = actorLabels[toId].orEmpty(),
                text = text
            )
        }
    }
    if (messages.isEmpty()) return null
    return MermaidDiagram.Sequence(
        actors = actorLabels.values.toList(),
        messages = messages
    )
}

private fun parseMermaidClassDiagram(source: String): MermaidDiagram.ClassDiagram? {
    val lines = source.lines().map { it.trim() }.filter { it.isNotBlank() }
    if (lines.isEmpty()) return null
    val header = lines.first().lowercase()
    if (!header.startsWith("classdiagram")) {
        return null
    }
    val classes = linkedMapOf<String, MutableList<String>>()
    val relations = mutableListOf<MermaidRelation>()
    val classDecl = Regex("""^class\s+([A-Za-z0-9_]+)$""")
    val memberDecl = Regex("""^([A-Za-z0-9_]+)\s*:\s*(.+)$""")
    val relationDecl = Regex("""^([A-Za-z0-9_]+)\s+[^A-Za-z0-9\s]*--[^A-Za-z0-9\s]*\s+([A-Za-z0-9_]+)(?:\s*:\s*(.+))?$""")

    lines.drop(1).forEach { line ->
        classDecl.matchEntire(line)?.let { match ->
            classes.putIfAbsent(match.groupValues[1], mutableListOf())
            return@forEach
        }
        memberDecl.matchEntire(line)?.let { match ->
            val className = match.groupValues[1]
            val member = match.groupValues[2].trim()
            if (member.isNotBlank()) {
                classes.getOrPut(className) { mutableListOf() }.add(member)
            }
            return@forEach
        }
        relationDecl.matchEntire(line)?.let { match ->
            val from = match.groupValues[1]
            val to = match.groupValues[2]
            classes.putIfAbsent(from, mutableListOf())
            classes.putIfAbsent(to, mutableListOf())
            relations += MermaidRelation(
                from = from,
                to = to,
                label = match.groupValues.getOrNull(3)?.trim().orEmpty().ifBlank { null }
            )
        }
    }
    if (classes.isEmpty() && relations.isEmpty()) return null
    return MermaidDiagram.ClassDiagram(
        classes = classes.entries.map { MermaidClass(name = it.key, members = it.value.toList()) },
        relations = relations
    )
}

private fun parseMermaidStateDiagram(source: String): MermaidDiagram.StateDiagram? {
    val lines = source.lines().map { it.trim() }.filter { it.isNotBlank() }
    if (lines.isEmpty()) return null
    val header = lines.first().lowercase()
    if (!header.startsWith("statediagram")) {
        return null
    }
    val states = linkedSetOf<String>()
    val transitions = mutableListOf<MermaidRelation>()
    val transitionDecl = Regex("""^([A-Za-z0-9_\[\]\*]+)\s*-->\s*([A-Za-z0-9_\[\]\*]+)(?:\s*:\s*(.+))?$""")

    lines.drop(1).forEach { line ->
        transitionDecl.matchEntire(line)?.let { match ->
            val from = normalizeStateName(match.groupValues[1])
            val to = normalizeStateName(match.groupValues[2])
            states += from
            states += to
            transitions += MermaidRelation(
                from = from,
                to = to,
                label = match.groupValues.getOrNull(3)?.trim().orEmpty().ifBlank { null }
            )
        }
    }
    if (states.isEmpty()) return null
    return MermaidDiagram.StateDiagram(
        states = states.toList(),
        transitions = transitions
    )
}

private fun normalizeStateName(value: String): String {
    return when (value.trim()) {
        "[*]" -> "Start/End"
        else -> value.trim().removePrefix("[").removeSuffix("]")
    }
}

private fun isTableRow(line: String): Boolean {
    if (!line.contains('|')) return false
    val trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) return true
    val pipeCount = trimmed.count { it == '|' }
    return pipeCount >= 2
}

private fun parseTableRow(line: String): List<String> {
    val normalized = line.trim().trim('|')
    return normalized
        .split('|')
        .map { inlineMarkdown(it.trim()) }
}

private fun isDividerRow(row: List<String>): Boolean {
    if (row.isEmpty()) return false
    return row.all { cell ->
        val normalized = cell.replace(":", "").replace("-", "")
        normalized.isEmpty() && cell.contains('-')
    }
}

@Composable
private fun MarkdownTable(block: MarkdownBlock) {
    val rows = block.cells.filter { it.isNotEmpty() }
    if (rows.isEmpty()) return
    val header = rows.first()
    val dataRows = when {
        rows.size > 1 && isDividerRow(rows[1]) -> rows.drop(2)
        else -> rows.drop(1)
    }
    val horizontal = rememberScrollState()
    val columnCount = rows.maxOfOrNull { it.size } ?: header.size
    val columnWidth = preferredTableColumnWidth(columnCount)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8FAFC), RoundedCornerShape(12.dp))
            .horizontalScroll(horizontal)
            .padding(1.dp)
    ) {
        MarkdownTableRow(
            cells = header,
            header = true,
            columnWidth = columnWidth
        )
        dataRows.forEach { row ->
            MarkdownTableRow(cells = row, columnWidth = columnWidth)
        }
    }
}

@Composable
private fun MarkdownTableRow(cells: List<String>, header: Boolean = false, columnWidth: Dp) {
    Row(
        modifier = Modifier
            .background(if (header) Color(0xFFEFF3F8) else Color.White)
    ) {
        cells.forEach { cell ->
            Text(
                text = cell,
                style = if (header) MaterialTheme.typography.labelMedium else MaterialTheme.typography.bodySmall,
                fontWeight = if (header) FontWeight.SemiBold else FontWeight.Normal,
                modifier = Modifier
                    .widthIn(min = columnWidth)
                    .padding(horizontal = 12.dp, vertical = 10.dp)
            )
        }
    }
}

private fun preferredTableColumnWidth(columnCount: Int): Dp {
    return when {
        columnCount <= 2 -> 220.dp
        columnCount == 3 -> 180.dp
        columnCount == 4 -> 160.dp
        else -> 140.dp
    }
}
