package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*

object ReportRuntimeStructure {
    fun composites(blocks: List<DashboardReportRuntimeBlockSummary>): List<DashboardReportRuntimeBlockSummary> {
        val index = blocks.associateBy { it.id }
        val parents = mutableMapOf<String, String>()
        val children = mutableMapOf<String, MutableList<String>>()
        for (block in blocks.filter { it.kind == "compositeBlock" }) {
            for (value in (block.content["childBlockIds"] as? JsonArray).orEmpty()) {
                val child = (value as? JsonPrimitive)?.takeIf { it.isString }?.content?.trim().orEmpty()
                if (child.isEmpty() || child !in index || child in parents) continue
                var ancestor: String? = block.id
                while (ancestor != null && ancestor != child) ancestor = parents[ancestor]
                if (ancestor == child) continue
                parents[child] = block.id
                children.getOrPut(block.id) { mutableListOf() }.add(child)
            }
        }
        fun attach(block: DashboardReportRuntimeBlockSummary): DashboardReportRuntimeBlockSummary = block.copy(
            compositeParentId = parents[block.id], children = children[block.id].orEmpty().mapNotNull(index::get).map(::attach)
        )
        return blocks.map(::attach)
    }
}
