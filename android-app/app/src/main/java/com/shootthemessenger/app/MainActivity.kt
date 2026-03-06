package com.shootthemessenger.app

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.appbar.MaterialToolbar

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val toolbar: MaterialToolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)

        val delayInput: EditText = findViewById(R.id.delayInput)
        val statusText: TextView = findViewById(R.id.statusText)

        val prefs = getSharedPreferences(MessengerAutomationService.PREFS, MODE_PRIVATE)
        delayInput.setText(prefs.getLong(MessengerAutomationService.KEY_DELAY_MS, 1200L).toString())
        statusText.text = if (prefs.getBoolean(MessengerAutomationService.KEY_RUNNING, false)) {
            getString(R.string.status_running)
        } else {
            getString(R.string.status_stopped)
        }

        findViewById<Button>(R.id.enableAccessibilityButton).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        findViewById<Button>(R.id.openMessengerButton).setOnClickListener {
            val launchIntent = packageManager.getLaunchIntentForPackage("com.facebook.orca")
            if (launchIntent != null) {
                startActivity(launchIntent)
            } else {
                statusText.text = getString(R.string.messenger_not_installed)
            }
        }

        findViewById<Button>(R.id.startButton).setOnClickListener {
            val delayMs = delayInput.text.toString().toLongOrNull()?.coerceIn(200L, 15_000L) ?: 1200L
            prefs.edit()
                .putLong(MessengerAutomationService.KEY_DELAY_MS, delayMs)
                .putBoolean(MessengerAutomationService.KEY_RUNNING, true)
                .apply()
            statusText.text = getString(R.string.status_running)
        }

        findViewById<Button>(R.id.stopButton).setOnClickListener {
            prefs.edit().putBoolean(MessengerAutomationService.KEY_RUNNING, false).apply()
            statusText.text = getString(R.string.status_stopped)
        }
    }
}
