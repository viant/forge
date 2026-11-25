package com.viant.forgeandroid.runtime

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.flow.StateFlow

class Signal<T>(initial: T) {
    private val state = MutableStateFlow(initial)
    val flow: StateFlow<T> = state

    fun set(value: T) {
        state.value = value
    }

    internal fun update(transform: (T) -> T) = state.update(transform)

    fun peek(): T = state.value
}
