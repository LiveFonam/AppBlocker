package com.nova.appblocker

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import org.json.JSONArray

// Accessibility Service: runs in background and redirects blocked apps.
// User must manually enable it in Settings > Accessibility > Nova Focus.
class BlockerAccessibilityService : AccessibilityService() {

    // Debounce redirects so we do not relaunch on every window event (avoids flicker).
    private var lastRedirectAt = 0L
    private val redirectCooldownMs = 1500L

    override fun onServiceConnected() {
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            notificationTimeout = 100
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return

        val prefs = getSharedPreferences("nova_appblocker", Context.MODE_PRIVATE)
        val isBlocking = prefs.getBoolean("isBlocking", false)
        if (!isBlocking) return

        val raw = prefs.getString("blockedPackages", "[]") ?: "[]"
        val blocked = try {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { arr.getString(it) }.toSet()
        } catch (e: Exception) { emptySet() }

        if (pkg in blocked && pkg != packageName) {
            // Ignore repeat redirects within the cooldown window to avoid rapid flicker.
            val now = System.currentTimeMillis()
            if (now - lastRedirectAt < redirectCooldownMs) return
            lastRedirectAt = now

            // Prefer sending the user home over relaunching our full app on every event.
            if (performGlobalAction(GLOBAL_ACTION_HOME)) return

            // Fallback: redirect to our app, shows the blocking dashboard.
            val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("blockedApp", pkg)
            }
            if (intent != null) startActivity(intent)
        }
    }

    override fun onInterrupt() {}
}
