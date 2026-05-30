package com.nova.appblocker

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Process
import com.facebook.react.bridge.*
import org.json.JSONArray

class AppBlockerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppBlocker"

    private val prefs: SharedPreferences
        get() = reactContext.getSharedPreferences("nova_appblocker", Context.MODE_PRIVATE)

    // Returns list of launchable installed apps
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            // Query launchable activities directly (works with a <queries> launcher element
            // in the manifest, without QUERY_ALL_PACKAGES).
            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val apps = pm.queryIntentActivities(launcherIntent, 0)
                .map { it.activityInfo.packageName }
                .distinct()
                .filter { it != reactContext.packageName }
                .map { packageName ->
                    val label = try {
                        pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
                    } catch (e: Exception) { packageName }
                    Arguments.createMap().apply {
                        putString("id",   packageName)
                        putString("name", label)
                        putString("icon", "")   // icons require base64 encoding; add if needed
                        putString("color", "#888888")
                    }
                }
            val result = Arguments.createArray()
            apps.forEach { result.pushMap(it) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_APPS_ERROR", e.message, e)
        }
    }

    // Start blocking: saves package list and starts Accessibility Service
    @ReactMethod
    fun startBlocking(packages: ReadableArray, promise: Promise) {
        try {
            val list = JSONArray()
            for (i in 0 until packages.size()) list.put(packages.getString(i))
            prefs.edit()
                .putString("blockedPackages", list.toString())
                .putBoolean("isBlocking", true)
                .apply()

            // Accessibility Service reads from SharedPreferences, no restart needed
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopBlocking(promise: Promise) {
        prefs.edit()
            .putBoolean("isBlocking", false)
            .apply()
        promise.resolve(null)
    }

    @ReactMethod
    fun isBlocking(promise: Promise) {
        promise.resolve(prefs.getBoolean("isBlocking", false))
    }

    @ReactMethod
    fun getSelectedCount(promise: Promise) {
        val raw = prefs.getString("blockedPackages", "[]") ?: "[]"
        val arr = try { JSONArray(raw) } catch (e: Exception) { JSONArray() }
        promise.resolve(arr.length())
    }

    // Checks whether the user has granted usage-access permission to this app.
    private fun hasUsageAccess(): Boolean {
        val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
            ?: return false
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            reactContext.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    @ReactMethod
    fun hasUsageAccess(promise: Promise) {
        promise.resolve(hasUsageAccess())
    }

    // Opens the system Usage Access settings so the user can grant permission.
    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            val intent = Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: ActivityNotFoundException) {
            promise.reject("NO_USAGE_ACCESS_SETTINGS", e.message, e)
        }
    }

    @ReactMethod
    fun getUsageStats(promise: Promise) {
        try {
            if (!hasUsageAccess()) {
                promise.reject("NO_USAGE_ACCESS", "Usage access permission not granted")
                return
            }
            val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
                ?: run {
                    promise.reject("NO_USAGE_STATS_SERVICE", "UsageStatsManager unavailable")
                    return
                }
            val end = System.currentTimeMillis()
            val start = end - 24L * 60 * 60 * 1000
            val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, start, end)
            if (stats.isNullOrEmpty()) { promise.resolve(Arguments.createArray()); return }
            val pm = reactContext.packageManager
            val result = Arguments.createArray()
            stats
                .filter { it.totalTimeInForeground > 60_000 }
                .filter { pm.getLaunchIntentForPackage(it.packageName) != null }
                .filter { it.packageName != reactContext.packageName }
                .sortedByDescending { it.totalTimeInForeground }
                .take(20)
                .forEach { stat ->
                    val map = Arguments.createMap()
                    map.putString("packageName", stat.packageName)
                    map.putInt("totalMinutes", (stat.totalTimeInForeground / 60_000L).toInt())
                    val name = try { pm.getApplicationLabel(pm.getApplicationInfo(stat.packageName, 0)).toString() } catch (e: Exception) { stat.packageName }
                    map.putString("name", name)
                    result.pushMap(map)
                }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    // Opens Android Accessibility Settings so user can enable the service
    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: ActivityNotFoundException) {
            promise.reject("NO_ACCESSIBILITY_SETTINGS", e.message, e)
        }
    }
}
