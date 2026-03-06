package com.shootthemessenger.app

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class MessengerAutomationService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private var lastActionAt = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.packageName?.toString() != MESSENGER_PACKAGE) return

        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val running = prefs.getBoolean(KEY_RUNNING, false)
        if (!running) return

        val now = System.currentTimeMillis()
        if (now - lastActionAt < 550) return

        val root = rootInActiveWindow ?: return
        tryUnsendSheet(root)

        val delayMs = prefs.getLong(KEY_DELAY_MS, 1200L)
        val target = findLikelySentBubble(root)
        if (target != null) {
            if (target.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)) {
                lastActionAt = System.currentTimeMillis()
                handler.postDelayed({
                    val refreshed = rootInActiveWindow ?: return@postDelayed
                    clickNodeWithAnyText(refreshed, UNSEND_MENU_TEXTS)
                    handler.postDelayed({
                        val refreshed2 = rootInActiveWindow ?: return@postDelayed
                        clickNodeWithAnyText(refreshed2, UNSEND_EVERYONE_TEXTS)
                    }, 350)
                }, 350)
                handler.postDelayed({
                    performGlobalAction(GLOBAL_ACTION_SCROLL_BACKWARD)
                }, delayMs)
            }
        }
    }

    override fun onInterrupt() = Unit

    private fun tryUnsendSheet(root: AccessibilityNodeInfo) {
        if (clickNodeWithAnyText(root, UNSEND_EVERYONE_TEXTS)) {
            lastActionAt = System.currentTimeMillis()
            return
        }
        clickNodeWithAnyText(root, UNSEND_MENU_TEXTS)
    }

    private fun findLikelySentBubble(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        val screenWidth = resources.displayMetrics.widthPixels
        val candidates = mutableListOf<AccessibilityNodeInfo>()
        collectNodes(root, candidates)
        return candidates
            .filter { node ->
                val text = node.text?.toString().orEmpty().trim()
                text.isNotEmpty() &&
                    !UNSEND_STATUS_TEXTS.any { text.contains(it, ignoreCase = true) } &&
                    isLikelyRightAligned(node, screenWidth)
            }
            .sortedByDescending { node ->
                val r = Rect(); node.getBoundsInScreen(r); r.bottom
            }
            .firstOrNull()
    }

    private fun collectNodes(node: AccessibilityNodeInfo, out: MutableList<AccessibilityNodeInfo>) {
        if (node.isVisibleToUser && (node.isClickable || node.isLongClickable)) {
            out.add(node)
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            collectNodes(child, out)
        }
    }

    private fun isLikelyRightAligned(node: AccessibilityNodeInfo, screenWidth: Int): Boolean {
        val rect = Rect()
        node.getBoundsInScreen(rect)
        if (rect.width() <= 0 || rect.height() <= 0) return false
        val centerX = (rect.left + rect.right) / 2
        return centerX > (screenWidth * 0.58)
    }

    private fun clickNodeWithAnyText(root: AccessibilityNodeInfo, texts: List<String>): Boolean {
        for (text in texts) {
            val found = root.findAccessibilityNodeInfosByText(text)
            for (node in found) {
                if (!node.isVisibleToUser) continue
                if (node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
                val parent = node.parent
                if (parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true) return true

                val bundle = Bundle().apply {
                    putInt(
                        AccessibilityNodeInfo.ACTION_ARGUMENT_MOVEMENT_GRANULARITY_INT,
                        AccessibilityNodeInfo.MOVEMENT_GRANULARITY_PAGE
                    )
                }
                node.performAction(AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY, bundle)
            }
        }
        return false
    }

    companion object {
        const val PREFS = "stm_automation"
        const val KEY_RUNNING = "running"
        const val KEY_DELAY_MS = "delay_ms"
        private const val MESSENGER_PACKAGE = "com.facebook.orca"

        private val UNSEND_MENU_TEXTS = listOf(
            "Visszavonás",
            "Unsend",
            "Eltávolítás",
            "Remove"
        )

        private val UNSEND_EVERYONE_TEXTS = listOf(
            "Visszavonás mindenkinél",
            "Unsend for everyone",
            "Remove for everyone"
        )

        private val UNSEND_STATUS_TEXTS = listOf(
            "visszavontad ezt az üzenetet",
            "you unsent a message"
        )
    }
}
