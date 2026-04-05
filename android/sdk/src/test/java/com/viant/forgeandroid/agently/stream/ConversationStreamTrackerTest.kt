package com.viant.forgeandroid.agently.stream

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class ConversationStreamTrackerTest {

    @Test
    fun `late duplicated message patch does not overwrite clean final assistant content`() {
        val tracker = ConversationStreamTracker("conv-1")
        val messageId = "msg-1"
        val turnId = "turn-1"
        val cleanFinal = """
            1. Got it — here’s a short, structured response.

            2. Kotlin example:
            ```kotlin
            fun reply(): String = "Hello!"
            ```
        """.trimIndent()
        val duplicatedPatch = """
            1. Got it — here’s a short, structured response.

            2. Kotlin example:
            ```kotlinfun reply(): String = "Hello!"
            ```1. Got it — here’s a short, structured response.

            2. Kotlin example:
            ```kotlin
            fun reply(): String = "Hello!"
            ```
        """.trimIndent()

        tracker.applyEvent(
            SSEEvent(
                id = messageId,
                conversationId = "conv-1",
                turnId = turnId,
                messageId = messageId,
                assistantMessageId = messageId,
                type = "assistant_final",
                content = cleanFinal
            )
        )
        tracker.applyEvent(
            SSEEvent(
                id = messageId,
                conversationId = "conv-1",
                turnId = turnId,
                messageId = messageId,
                type = "control",
                op = "message_patch",
                patch = buildJsonObject {
                    put("content", duplicatedPatch)
                    put("interim", 0)
                }
            )
        )

        val snapshot = tracker.snapshot()
        val assistant = snapshot.bufferedMessages.single { it.id == messageId }
        assertEquals(cleanFinal, assistant.content)
        assertEquals(0, assistant.interim)
    }

    @Test
    fun `collapseRepeatedContent keeps last clean segment`() {
        val input = """
            Hello there.
            ```kotlinfun hi() = "x"
            ```Hello there.
            ```kotlin
            fun hi() = "x"
            ```
        """.trimIndent()

        val collapsed = collapseRepeatedContent(input)

        assertEquals(
            """
            Hello there.
            ```kotlin
            fun hi() = "x"
            ```
            """.trimIndent(),
            collapsed
        )
    }
}
