package com.viant.forgeandroid.runtime

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.flow.StateFlow

class Signal<T>(initial: T) {
    private val state = MutableStateFlow(initial)
    val flow: StateFlow<T> = state
    @Volatile private var observers: java.util.concurrent.CopyOnWriteArrayList<(T) -> Unit>? = null

    fun set(value: T) {
        state.value = value
        observers?.forEach { it(value) }
    }

    internal fun update(transform: (T) -> T) {
        var next = state.value
        state.update { transform(it).also { value -> next = value } }
        observers?.forEach { it(next) }
    }

    // This presentation-scoped observation sees every mutation, including
    // away/back changes that the public StateFlow may legitimately conflate.
    internal fun observeChanges(observer: (T) -> Unit): () -> Unit {
        synchronized(this) {
            val active = observers ?: java.util.concurrent.CopyOnWriteArrayList<(T) -> Unit>().also { observers = it }
            active.add(observer)
        }
        observer(state.value)
        return {
            synchronized(this) {
                observers?.let { active ->
                    active.remove(observer)
                    if (active.isEmpty()) observers = null
                }
            }
        }
    }

    fun peek(): T = state.value
}
