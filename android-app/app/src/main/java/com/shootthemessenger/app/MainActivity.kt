package com.shootthemessenger.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.appbar.MaterialToolbar

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var delayInput: EditText

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val toolbar: MaterialToolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)

        webView = findViewById(R.id.webView)
        delayInput = findViewById(R.id.delayInput)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.userAgentString = webView.settings.userAgentString + " STM-Android"
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.loadUrl("https://www.messenger.com")

        findViewById<Button>(R.id.startButton).setOnClickListener {
            val delayMs = delayInput.text.toString().toLongOrNull() ?: 5000L
            runAutomation(delayMs)
        }

        findViewById<Button>(R.id.stopButton).setOnClickListener {
            webView.evaluateJavascript("window.STM_ANDROID?.stop();", null)
        }
    }

    private fun runAutomation(delayMs: Long) {
        val jsBootstrap = assets.open("stm_android.js").bufferedReader().use { it.readText() }
        webView.evaluateJavascript(jsBootstrap, null)
        webView.evaluateJavascript("window.STM_ANDROID?.start($delayMs);", null)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
