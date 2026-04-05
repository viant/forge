package com.viant.forgeandroid.runtime

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import java.util.concurrent.ConcurrentHashMap

class MemoryCookieJar : CookieJar {
    private val store = ConcurrentHashMap<String, MutableList<Cookie>>()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (cookies.isEmpty()) {
            return
        }
        val key = jarKey(url)
        val existing = store.computeIfAbsent(key) { mutableListOf() }
        synchronized(existing) {
            cookies.forEach { incoming ->
                existing.removeAll { current ->
                    current.name == incoming.name &&
                        current.domain == incoming.domain &&
                        current.path == incoming.path
                }
                if (incoming.expiresAt >= System.currentTimeMillis()) {
                    existing += incoming
                }
            }
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        return store.values.flatMap { bucket ->
            synchronized(bucket) {
                bucket.removeAll { it.expiresAt < now }
                bucket.filter { cookie ->
                    cookie.matches(url)
                }
            }
        }
    }

    fun clear() {
        store.clear()
    }

    private fun jarKey(url: HttpUrl): String = url.host
}

fun sessionHttpClient(cookieJar: CookieJar = MemoryCookieJar()): OkHttpClient {
    return OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .build()
}
