package com.viant.forgeandroid.runtime

import java.time.*
import java.time.temporal.ChronoUnit

object NativeDateRangePreset {
    fun patch(item: ItemDef, value: String, metrics: Map<String, Any?> = emptyMap(), now: Instant = Instant.now()): Map<String, Any?>? {
        fun property(key: String) = (item.properties[key] as? kotlinx.serialization.json.JsonPrimitive)?.content
        val zone = (item.timeZoneSelector ?: property("timeZoneSelector"))?.let { SelectorUtil.resolve(metrics,it)?.toString() } ?: item.timeZone ?: property("timeZone") ?: "UTC"
        val lifetime = (item.lifetimeStartSelector ?: property("lifetimeStartSelector"))?.let { SelectorUtil.resolve(metrics,it)?.toString() } ?: item.lifetimeStart ?: property("lifetimeStart") ?: "2026-01-01"
        val range = resolve(value, now, zone, lifetime) ?: return null
        return mapOf((item.startField ?: property("startField") ?: "customDateStart") to range["start"], (item.endField ?: property("endField") ?: "customDateEnd") to range["end"], (item.granularityField ?: property("granularityField") ?: "granularity") to range["granularity"])
    }
    fun resolve(value: String, now: Instant = Instant.now(), timeZone: String = "UTC", lifetimeStart: String = "2026-01-01"): Map<String, Any?>? {
        val zone = runCatching { ZoneId.of(timeZone) }.getOrDefault(ZoneOffset.UTC)
        val today = now.atZone(zone).toLocalDate()
        var end = today
        val start = when (value.lowercase()) {
            "today" -> today
            "yesterday" -> today.minusDays(1).also { end = it }
            "week" -> today.minusDays(6)
            "month" -> today.minusMonths(1)
            "month_to_date" -> today.withDayOfMonth(1)
            "last_month" -> today.withDayOfMonth(1).minusMonths(1).also { end = today.withDayOfMonth(1).minusDays(1) }
            "quarter_to_date" -> today.withMonth(((today.monthValue-1)/3)*3+1).withDayOfMonth(1)
            "year_to_date" -> today.withDayOfYear(1)
            "year" -> LocalDate.of(today.year-1,today.monthValue,1).plusDays((today.dayOfMonth-1).toLong())
            "last_year" -> LocalDate.of(today.year-1,1,1).also { end = LocalDate.of(today.year-1,12,31) }
            "lifetime" -> today
            else -> return null
        }
        return mapOf("start" to if (value.lowercase() == "lifetime") lifetimeStart else start.toString(), "end" to end.toString(), "granularity" to if (value.lowercase() != "lifetime" && ChronoUnit.DAYS.between(start,end)+1 <= 2) "hour" else "day")
    }
}
