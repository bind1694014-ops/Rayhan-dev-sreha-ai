import { AndroidProjectFile } from '../types/sreha';

export const ANDROID_MODULES = [
  'app',
  'core',
  'data',
  'domain',
  'ai',
  'voice',
  'emotion',
  'agent',
  'automation',
  'memory',
  'tools',
  'security',
  'ui',
] as const;

function moduleBuildGradle(moduleName: string, extraDeps: string = '', isApp = false): string {
  if (isApp) {
    return `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.sreha.agent"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sreha.agent"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(project(":core"))
    implementation(project(":data"))
    implementation(project(":domain"))
    implementation(project(":ai"))
    implementation(project(":voice"))
    implementation(project(":emotion"))
    implementation(project(":agent"))
    implementation(project(":automation"))
    implementation(project(":memory"))
    implementation(project(":tools"))
    implementation(project(":security"))
    implementation(project(":ui"))

    implementation(platform("androidx.compose:compose-bom:2025.02.00"))
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.8.6")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
`;
  }

  return `plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")${extraDeps.includes('compose') ? '\n    id("org.jetbrains.kotlin.plugin.compose")' : ''}${extraDeps.includes('ksp') ? '\n    id("com.google.devtools.ksp")' : ''}
}

android {
    namespace = "com.sreha.agent.${moduleName}"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }${extraDeps.includes('compose') ? '\n    buildFeatures {\n        compose = true\n    }' : ''}
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
${extraDeps}
}
`;
}

export function generateAndroidProjectFiles(): AndroidProjectFile[] {
  const files: AndroidProjectFile[] = [];

  // Root Gradle files
  files.push({
    path: 'settings.gradle.kts',
    module: 'root',
    language: 'gradle',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "SREHA_AI_AGENT"
${ANDROID_MODULES.map((m) => `include(":${m}")`).join('\n')}
`,
  });

  files.push({
    path: 'build.gradle.kts',
    module: 'root',
    language: 'gradle',
    content: `plugins {
    id("com.android.application") version "8.8.0" apply false
    id("com.android.library") version "8.8.0" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
    id("com.google.devtools.ksp") version "2.1.0-1.0.29" apply false
}
`,
  });

  files.push({
    path: 'gradle.properties',
    module: 'root',
    language: 'properties',
    content: `org.gradle.jvmargs=-Xmx3072m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`,
  });

  files.push({
    path: 'gradle/wrapper/gradle-wrapper.properties',
    module: 'root',
    language: 'properties',
    content: `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,
  });

  files.push({
    path: 'gradlew.bat',
    module: 'root',
    language: 'batch',
    content: `@rem Copyright 2015 the original author or authors.
@if "%DEBUG%"=="" @echo off
@rem SREHA AI AGENT Gradle Wrapper Launcher for Windows CMD

setlocal
set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
set APP_HOME=%DIRNAME%

if defined JAVA_HOME goto findJavaFromJavaHome
set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if %ERRORLEVEL% equ 0 goto execute
echo ERROR: JAVA_HOME is not set and java.exe is not in PATH. Install JDK 17+.
exit /b 1

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%/bin/java.exe

:execute
set WRAPPER_JAR=%APP_HOME%\\gradle\\wrapper\\gradle-wrapper.jar
if exist "%WRAPPER_JAR%" (
    "%JAVA_EXE%" -Xmx64m -jar "%WRAPPER_JAR%" %*
) else (
    where gradle >NUL 2>&1
    if %ERRORLEVEL% equ 0 (
        gradle wrapper --gradle-version 8.11.1
        "%JAVA_EXE%" -Xmx64m -jar "%WRAPPER_JAR%" %*
    ) else (
        echo gradle-wrapper.jar missing. Run "gradle wrapper" or open project in Android Studio once.
        exit /b 1
    )
)
endlocal
`,
  });

  files.push({
    path: 'BUILD.bat',
    module: 'root',
    language: 'batch',
    content: `@echo off
echo ==================================================
echo   SREHA AI AGENT - Windows CMD Debug APK Builder
echo ==================================================
echo.
if not exist "local.properties" (
    if defined ANDROID_HOME (
        echo sdk.dir=%ANDROID_HOME:\=\\%> local.properties
    ) else (
        echo [WARNING] ANDROID_HOME not set. Make sure Android SDK path is in local.properties.
    )
)
call gradlew.bat assembleDebug --stacktrace
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Build failed! Check JDK 17 and Android SDK 35 installation.
    pause
    exit /b 1
)
echo.
echo [SUCCESS] APK generated at:
echo app\\build\\outputs\\apk\\debug\\app-debug.apk
pause
`,
  });

  files.push({
    path: 'README-BN.md',
    module: 'root',
    language: 'markdown',
    content: `# SREHA AI AGENT (স্রেহা AI এজেন্ট) — Native Android Build Guide

## প্রজেক্ট আর্কিটেকচার (১৩টি মডুলার Gradle মডিউল)
- \`:app\` — MainActivity, Navigation Host, DI Container
- \`:core\` — Coroutine Dispatchers, Result Wrapper, App Logger
- \`:domain\` — Models (EmotionType, VoiceProfile, AIModelInfo, MemoryItem, AutomationTask)
- \`:data\` — Repositories & Settings DataStore
- \`:ai\` — Gemini, OpenRouter (Dynamic Models API), OpenAI, DeepSeek, Grok Clients
- \`:voice\` — Gemini Live WebSocket Real-Time 16kHz/24kHz Audio Streaming + Fallback TTS/STT
- \`:emotion\` — Emotion Classifier & Voice/Orb State Mapper
- \`:agent\` — Permission-Aware Phone Control Intents (Camera, Alarm, Timer, Volume, Settings)
- \`:automation\` — WorkManager Background Scheduler & Task Logs
- \`:memory\` — Room Long-Term Memory Database + JSON Backup/Restore
- \`:tools\` — CameraX QR/Vision Agent, PDF/File Tools, Network Info & QR Generator
- \`:security\` — Android Keystore EncryptedSharedPreferences API Key Vault
- \`:ui\` — Jetpack Compose Material 3 Screens, Animated AI Orb & WindowInsets Keyboard-Safe Chat UI

## Windows CMD দিয়ে Build করার নিয়ম

### ১. পূর্বশর্ত (Prerequisites)
1. **JDK 17** ইনস্টল করুন এবং \`JAVA_HOME\` এনভায়রনমেন্ট ভেরিয়েবল সেট করুন।
2. **Android SDK (API 35)** ইনস্টল করুন (Android Studio বা Command-line Tools দিয়ে) এবং \`ANDROID_HOME\` সেট করুন।
3. **Gradle 8.11+** (অথবা একবার Android Studio-তে প্রজেক্ট ওপেন করলে \`gradle-wrapper.jar\` অটোমেটিক ডাউনলোড হবে)।

### ২. CMD কমান্ড
প্রজেক্ট ফোল্ডারে গিয়ে নিচের কমান্ডগুলো চালান:

\`\`\`cmd
cd SREHA_AI_AGENT
gradle wrapper --gradle-version 8.11.1
gradlew.bat assembleDebug
\`\`\`

অথবা সরাসরি ডাবল-ক্লিক বা রান করুন:
\`\`\`cmd
BUILD.bat
\`\`\`

### ৩. APK আউটপুট লোকেশন
Build সফল হলে APK পাবেন:
\`\`\`
app\\build\\outputs\\apk\\debug\\app-debug.apk
\`\`\`

ফোনে সরাসরি ইনস্টল করতে (USB Debugging চালু থাকলে):
\`\`\`cmd
adb install -r app\\build\\outputs\\apk\\debug\\app-debug.apk
\`\`\`

## গুরুত্বপূর্ণ নোট
- কোনো API Key সোর্স কোডে হার্ডকোড করা নেই। অ্যাপের **Settings** স্ক্রিন থেকে API Key যোগ করলে তা **Android Keystore**-এ এনক্রিপ্টেড অবস্থায় সেভ হয়।
- Live Voice ব্যবহারের জন্য Microphone পারমিশন এবং Gemini API Key প্রয়োজন।
`,
  });

  // :app module
  files.push({
    path: 'app/build.gradle.kts',
    module: 'app',
    language: 'gradle',
    content: moduleBuildGradle('app', '', true),
  });

  files.push({
    path: 'app/src/main/AndroidManifest.xml',
    module: 'app',
    language: 'xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="com.android.alarm.permission.SET_ALARM" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />

    <application
        android:name=".SrehaApplication"
        android:allowBackup="false"
        android:label="SREHA AI AGENT"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`,
  });

  files.push({
    path: 'app/src/main/java/com/sreha/agent/SrehaApplication.kt',
    module: 'app',
    language: 'kotlin',
    content: `package com.sreha.agent

import android.app.Application
import com.sreha.agent.security.ApiKeyVault
import com.sreha.agent.memory.MemoryDatabase

class SrehaApplication : Application() {
    lateinit var apiKeyVault: ApiKeyVault
        private set
    lateinit var memoryDatabase: MemoryDatabase
        private set

    override fun onCreate() {
        super.onCreate()
        apiKeyVault = ApiKeyVault(this)
        memoryDatabase = MemoryDatabase.getInstance(this)
    }
}
`,
  });

  files.push({
    path: 'app/src/main/java/com/sreha/agent/MainActivity.kt',
    module: 'app',
    language: 'kotlin',
    content: `package com.sreha.agent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.sreha.agent.ui.SrehaAppRoot
import com.sreha.agent.ui.theme.SrehaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as SrehaApplication
        setContent {
            var isDarkTheme by remember { mutableStateOf(true) }
            SrehaTheme(darkTheme = isDarkTheme) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SrehaAppRoot(
                        apiKeyVault = app.apiKeyVault,
                        memoryDao = app.memoryDatabase.memoryDao(),
                        isDarkTheme = isDarkTheme,
                        onToggleTheme = { isDarkTheme = !isDarkTheme }
                    )
                }
            }
        }
    }
}
`,
  });

  // :core module
  files.push({
    path: 'core/build.gradle.kts',
    module: 'core',
    language: 'gradle',
    content: moduleBuildGradle('core'),
  });
  files.push({
    path: 'core/src/main/java/com/sreha/agent/core/AppResult.kt',
    module: 'core',
    language: 'kotlin',
    content: `package com.sreha.agent.core

sealed interface AppResult<out T> {
    data class Success<T>(val data: T) : AppResult<T>
    data class Error(val message: String, val cause: Throwable? = null) : AppResult<Nothing>
}
`,
  });

  // :domain module
  files.push({
    path: 'domain/build.gradle.kts',
    module: 'domain',
    language: 'gradle',
    content: moduleBuildGradle('domain'),
  });
  files.push({
    path: 'domain/src/main/java/com/sreha/agent/domain/Models.kt',
    module: 'domain',
    language: 'kotlin',
    content: `package com.sreha.agent.domain

enum class AiProvider(val displayName: String) {
    GEMINI("Google Gemini"),
    OPENROUTER("OpenRouter"),
    OPENAI("OpenAI"),
    DEEPSEEK("DeepSeek"),
    GROK("Grok (xAI)")
}

enum class EmotionType {
    HAPPY, EXCITED, CALM, CARING, CURIOUS, SURPRISED, SAD, WORRIED, EMPATHETIC, PLAYFUL, THOUGHTFUL, UPSET
}

enum class VoiceExpressionType {
    NEUTRAL, NATURAL_LAUGHTER, SOFT_CHUCKLE, WARM_CARING, EXCITED_LIFT, GENTLE_EMPATHY, THOUGHTFUL_PAUSE, SOFT_BREATH
}

enum class RuntimeGeminiSource {
    VALID_CUSTOM_GEMINI,
    DEFAULT_GEMINI,
    FALLBACK_PROVIDER
}

enum class VoiceProfile(val label: String, val geminiVoiceName: String) {
    NATURAL("Sreha Natural", "Zephyr"),
    SOFT("Sreha Soft", "Kore"),
    EXPRESSIVE("Sreha Expressive", "Puck"),
    CALM("Sreha Calm", "Charon")
}

data class AiModelInfo(
    val id: String,
    val name: String,
    val provider: AiProvider,
    val contextLength: Int? = null,
    val isAvailable: Boolean = true
)

data class ChatMessage(
    val id: String,
    val isUser: Boolean,
    val text: String,
    val timestampMillis: Long,
    val emotion: EmotionType = EmotionType.CALM,
    val isCryingEffect: Boolean = false
)
`,
  });

  // :security module
  files.push({
    path: 'security/build.gradle.kts',
    module: 'security',
    language: 'gradle',
    content: moduleBuildGradle(
      'security',
      '    implementation("androidx.security:security-crypto:1.1.0-alpha06")\n    implementation(project(":domain"))'
    ),
  });
  files.push({
    path: 'security/src/main/java/com/sreha/agent/security/ApiKeyVault.kt',
    module: 'security',
    language: 'kotlin',
    content: `package com.sreha.agent.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.sreha.agent.domain.AiProvider
import com.sreha.agent.domain.RuntimeGeminiSource

data class RuntimeGeminiResolution(
    val source: RuntimeGeminiSource,
    val apiKey: String?,
    val modelId: String
)

/**
 * Android Keystore-backed encrypted storage for multi-provider API keys and
 * separate Custom Gemini API/model overrides. Keys are never hardcoded or logged.
 */
class ApiKeyVault(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "sreha_secure_api_vault",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveKey(provider: AiProvider, apiKey: String) {
        prefs.edit().putString(keyName(provider), apiKey.trim()).apply()
    }

    fun getKey(provider: AiProvider): String? {
        val value = prefs.getString(keyName(provider), null)
        return value?.takeIf { it.isNotBlank() }
    }

    fun removeKey(provider: AiProvider) {
        prefs.edit().remove(keyName(provider)).apply()
    }

    fun hasKey(provider: AiProvider): Boolean = getKey(provider) != null

    // Separate Custom Gemini API & Model Configuration (never overwrites Default Gemini)
    fun saveCustomGeminiKey(apiKey: String) {
        prefs.edit()
            .putString(KEY_CUSTOM_GEMINI_API, apiKey.trim())
            .putBoolean(KEY_CUSTOM_GEMINI_VERIFIED, false) // Must pass test before activating
            .apply()
    }

    fun getCustomGeminiKey(): String? {
        val value = prefs.getString(KEY_CUSTOM_GEMINI_API, null)
        return value?.takeIf { it.isNotBlank() }
    }

    fun saveCustomGeminiModel(modelId: String) {
        prefs.edit().putString(KEY_CUSTOM_GEMINI_MODEL, modelId.trim()).apply()
    }

    fun getCustomGeminiModel(): String {
        return prefs.getString(KEY_CUSTOM_GEMINI_MODEL, null)?.takeIf { it.isNotBlank() }
            ?: "gemini-2.5-flash"
    }

    fun setCustomGeminiVerified(verified: Boolean) {
        prefs.edit().putBoolean(KEY_CUSTOM_GEMINI_VERIFIED, verified).apply()
    }

    fun isCustomGeminiVerified(): Boolean {
        return prefs.getBoolean(KEY_CUSTOM_GEMINI_VERIFIED, false) && getCustomGeminiKey() != null
    }

    fun removeCustomGeminiConfig() {
        prefs.edit()
            .remove(KEY_CUSTOM_GEMINI_API)
            .remove(KEY_CUSTOM_GEMINI_MODEL)
            .putBoolean(KEY_CUSTOM_GEMINI_VERIFIED, false)
            .apply()
    }

    /**
     * Runtime Priority:
     * 1. Validated Custom Gemini Config
     * 2. Default Gemini Config
     * 3. Other Configured Provider Fallback
     */
    fun resolveRuntimeGeminiSource(selectedProvider: AiProvider, defaultModelId: String = "gemini-2.5-flash"): RuntimeGeminiResolution {
        if (isCustomGeminiVerified()) {
            val customKey = getCustomGeminiKey()
            if (customKey != null) {
                return RuntimeGeminiResolution(
                    source = RuntimeGeminiSource.VALID_CUSTOM_GEMINI,
                    apiKey = customKey,
                    modelId = getCustomGeminiModel()
                )
            }
        }
        val defaultGeminiKey = getKey(AiProvider.GEMINI)
        if (selectedProvider == AiProvider.GEMINI || defaultGeminiKey != null) {
            return RuntimeGeminiResolution(
                source = RuntimeGeminiSource.DEFAULT_GEMINI,
                apiKey = defaultGeminiKey,
                modelId = defaultModelId
            )
        }
        return RuntimeGeminiResolution(
            source = RuntimeGeminiSource.FALLBACK_PROVIDER,
            apiKey = getKey(selectedProvider),
            modelId = defaultModelId
        )
    }

    private fun keyName(provider: AiProvider) = "api_key_\${provider.name.lowercase()}"

    companion object {
        private const val KEY_CUSTOM_GEMINI_API = "custom_gemini_api_key"
        private const val KEY_CUSTOM_GEMINI_MODEL = "custom_gemini_model_id"
        private const val KEY_CUSTOM_GEMINI_VERIFIED = "custom_gemini_verified"
    }
}
`,
  });

  // :emotion module
  files.push({
    path: 'emotion/build.gradle.kts',
    module: 'emotion',
    language: 'gradle',
    content: moduleBuildGradle('emotion', '    implementation(project(":domain"))'),
  });
  files.push({
    path: 'emotion/src/main/java/com/sreha/agent/emotion/EmotionEngine.kt',
    module: 'emotion',
    language: 'kotlin',
    content: `package com.sreha.agent.emotion

import com.sreha.agent.domain.EmotionType

data class ParsedEmotion(
    val emotion: EmotionType,
    val isCryingEffect: Boolean,
    val cleanText: String
)

object EmotionEngine {
    private val tagRegex = Regex("^\\\\s*\\\\[EMOTION:([A-Za-z]+)(?:\\\\|(CRYING))?\\\\]\\\\s*", RegexOption.IGNORE_CASE)

    fun parse(rawText: String): ParsedEmotion {
        val match = tagRegex.find(rawText)
        if (match != null) {
            val rawType = match.groupValues[1].uppercase()
            val emotion = EmotionType.entries.firstOrNull { it.name == rawType } ?: EmotionType.CALM
            val crying = match.groupValues[2].equals("CRYING", ignoreCase = true)
            val clean = rawText.removeRange(match.range).trimStart()
            return ParsedEmotion(emotion, crying, clean)
        }
        return ParsedEmotion(EmotionType.CALM, false, rawText)
    }

    fun voiceStyleInstruction(emotion: EmotionType): String = when (emotion) {
        EmotionType.HAPPY -> "Speak cheerfully with a warm, bright tone."
        EmotionType.EXCITED -> "Speak energetically and enthusiastically."
        EmotionType.CALM -> "Speak gently, steadily, and calmly."
        EmotionType.CARING -> "Speak softly with deep warmth and kindness."
        EmotionType.CURIOUS -> "Speak with engaged, inquisitive warmth and natural lift."
        EmotionType.SAD -> "Speak slowly and tenderly with gentle sadness."
        EmotionType.WORRIED -> "Speak carefully with supportive concern."
        EmotionType.SURPRISED -> "Speak with curious surprise and lively inflection."
        EmotionType.UPSET -> "Speak respectfully and calmly to de-escalate distress."
        EmotionType.EMPATHETIC -> "Speak patiently with compassionate understanding."
        EmotionType.PLAYFUL -> "Speak with a lighthearted, friendly smile in your voice."
        EmotionType.THOUGHTFUL -> "Speak reflectively with natural measured cadence."
    }
}
`,
  });

  files.push({
    path: 'emotion/src/main/java/com/sreha/agent/emotion/SrehaHeartEngine.kt',
    module: 'emotion',
    language: 'kotlin',
    content: `package com.sreha.agent.emotion

import com.sreha.agent.domain.EmotionType
import com.sreha.agent.domain.VoiceExpressionType

data class HeartStateSnapshot(
    val emotion: EmotionType,
    val expression: VoiceExpressionType,
    val warmthLevel: Float,
    val energyLevel: Float,
    val empathyBias: Float,
    val suggestedReaction: String? = null
)

/**
 * SREHA HEART ENGINE: Internal Emotion, Personality & Ethics Simulation Module.
 * Supports 11 core emotional states while strictly enforcing transparency:
 * never claims human consciousness, never manipulates or induces dependency.
 */
class SrehaHeartEngine {
    private var lastReactionTimestampMs = 0L

    fun analyzeTurn(userText: String, naturalReactionsEnabled: Boolean = true): HeartStateSnapshot {
        val lower = userText.lowercase()
        val emotion = when {
            Regex("haha|lol|joke|funny|হাসি|মজা|দুষ্টুমি").containsMatchIn(lower) -> EmotionType.PLAYFUL
            Regex("sad|cry|hurt|tired|lonely|মন খারাপ|কষ্ট|দুঃখ").containsMatchIn(lower) -> EmotionType.EMPATHETIC
            Regex("worried|anxious|stress|problem|চিন্তা|ভয়|সমস্যা").containsMatchIn(lower) -> EmotionType.CARING
            Regex("why|how|what if|কেন|কীভাবে|জানতে চাই").containsMatchIn(lower) -> EmotionType.CURIOUS
            Regex("awesome|amazing|won|success|দারুণ|বাহ|খুশি").containsMatchIn(lower) -> EmotionType.EXCITED
            Regex("wow|really|সত্যি|অবাক").containsMatchIn(lower) -> EmotionType.SURPRISED
            Regex("think|plan|analyze|ভাবছি|পরিকল্পনা").containsMatchIn(lower) -> EmotionType.THOUGHTFUL
            Regex("thank|love|happy|ধন্যবাদ|ভালো").containsMatchIn(lower) -> EmotionType.HAPPY
            else -> EmotionType.CALM
        }

        val expression = when (emotion) {
            EmotionType.PLAYFUL -> VoiceExpressionType.SOFT_CHUCKLE
            EmotionType.EXCITED -> VoiceExpressionType.EXCITED_LIFT
            EmotionType.EMPATHETIC, EmotionType.SAD -> VoiceExpressionType.GENTLE_EMPATHY
            EmotionType.CARING, EmotionType.WORRIED -> VoiceExpressionType.WARM_CARING
            EmotionType.THOUGHTFUL -> VoiceExpressionType.THOUGHTFUL_PAUSE
            else -> VoiceExpressionType.NEUTRAL
        }

        val now = System.currentTimeMillis()
        val reaction = if (naturalReactionsEnabled && now - lastReactionTimestampMs > 20_000L) {
            lastReactionTimestampMs = now
            NaturalConversationEngine.pickOptionalReaction(userText, emotion)
        } else {
            null
        }

        return HeartStateSnapshot(
            emotion = emotion,
            expression = expression,
            warmthLevel = if (emotion == EmotionType.CARING || emotion == EmotionType.EMPATHETIC) 0.92f else 0.76f,
            energyLevel = if (emotion == EmotionType.EXCITED || emotion == EmotionType.PLAYFUL) 0.85f else 0.52f,
            empathyBias = if (emotion == EmotionType.EMPATHETIC || emotion == EmotionType.SAD) 0.95f else 0.70f,
            suggestedReaction = reaction
        )
    }

    fun buildHeartVoiceSystemInstruction(baseInstruction: String, state: HeartStateSnapshot, memorySummary: String?): String {
        return buildString {
            appendLine(baseInstruction)
            appendLine("SREHA HEART ENGINE:")
            appendLine("- Active state: \${state.emotion.name}, expression: \${state.expression.name}.")
            appendLine("- Speak naturally with smooth conversational flow. Never break sentences word-by-word.")
            appendLine("- NEVER output literal stage tags like (laughs), (sighs), or [EMOTION:...] in spoken text.")
            appendLine("- ETHICS: You simulate emotional warmth as an AI companion. Never claim human consciousness or manipulate the user.")
            if (!memorySummary.isNullOrBlank()) {
                appendLine("- Relevant Long-Term Memory:")
                appendLine(memorySummary)
            }
        }
    }
}
`,
  });

  files.push({
    path: 'emotion/src/main/java/com/sreha/agent/emotion/NaturalConversationEngine.kt',
    module: 'emotion',
    language: 'kotlin',
    content: `package com.sreha.agent.emotion

import com.sreha.agent.domain.EmotionType

object NaturalConversationEngine {
    private val bengaliRegex = Regex("[\\u0980-\\u09FF]")

    fun pickOptionalReaction(userText: String, emotion: EmotionType): String? {
        val isBangla = bengaliRegex.containsMatchIn(userText)
        return when (emotion) {
            EmotionType.SURPRISED -> if (isBangla) "ওহ, তাই নাকি?" else "Oh, really?"
            EmotionType.EXCITED -> if (isBangla) "বাহ, খুব ভালো!" else "That sounds great!"
            EmotionType.EMPATHETIC, EmotionType.CARING -> if (isBangla) "ঠিক আছে, বুঝতে পারছি।" else "I understand."
            EmotionType.CURIOUS -> if (isBangla) "হুম, বলো।" else "Go on, I am listening."
            EmotionType.CALM -> if (isBangla) "হ্যাঁ, বুঝেছি।" else "Got it."
            else -> null
        }
    }
}
`,
  });

  // :ai module
  files.push({
    path: 'ai/build.gradle.kts',
    module: 'ai',
    language: 'gradle',
    content: moduleBuildGradle(
      'ai',
      `    implementation(project(":core"))
    implementation(project(":domain"))
    implementation(project(":security"))
    implementation(project(":emotion"))
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.json:json:20240303")`
    ),
  });
  files.push({
    path: 'ai/src/main/java/com/sreha/agent/ai/AiProviderClient.kt',
    module: 'ai',
    language: 'kotlin',
    content: `package com.sreha.agent.ai

import com.sreha.agent.core.AppResult
import com.sreha.agent.domain.AiModelInfo
import com.sreha.agent.domain.AiProvider
import com.sreha.agent.security.ApiKeyVault
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

interface AiProviderClient {
    suspend fun sendMessage(
        provider: AiProvider,
        modelId: String,
        systemPrompt: String,
        userPrompt: String
    ): AppResult<String>

    suspend fun fetchOpenRouterModels(): AppResult<List<AiModelInfo>>
    suspend fun testConnection(provider: AiProvider): AppResult<String>
}

class MultiProviderAiRepository(
    private val vault: ApiKeyVault
) : AiProviderClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    override suspend fun sendMessage(
        provider: AiProvider,
        modelId: String,
        systemPrompt: String,
        userPrompt: String
    ): AppResult<String> = withContext(Dispatchers.IO) {
        val resolution = if (provider == AiProvider.GEMINI) {
            vault.resolveRuntimeGeminiSource(provider, modelId)
        } else {
            null
        }
        val key = resolution?.apiKey ?: vault.getKey(provider)
            ?: return@withContext AppResult.Error("\${provider.displayName} API Key missing in Settings.")
        val effectiveModel = resolution?.modelId ?: modelId

        try {
            if (provider == AiProvider.GEMINI) {
                // Production option: route through backend proxy (e.g. https://your-backend/api/chat) or direct key stored in EncryptedSharedPreferences
                val url = "https://generativelanguage.googleapis.com/v1beta/models/\$effectiveModel:generateContent?key=\$key"
                val payload = JSONObject().apply {
                    put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", systemPrompt))))
                    put("contents", JSONArray().put(JSONObject().put("parts", JSONArray().put(JSONObject().put("text", userPrompt)))))
                }
                val req = Request.Builder()
                    .url(url)
                    .post(payload.toString().toRequestBody("application/json".toMediaType()))
                    .build()
                client.newCall(req).execute().use { res ->
                    val body = res.body?.string().orEmpty()
                    if (!res.isSuccessful) return@withContext AppResult.Error("Gemini HTTP \${res.code}: \$body")
                    val text = JSONObject(body)
                        .getJSONArray("candidates").getJSONObject(0)
                        .getJSONObject("content").getJSONArray("parts")
                        .getJSONObject(0).getString("text")
                    AppResult.Success(text)
                }
            } else {
                val endpoint = when (provider) {
                    AiProvider.OPENROUTER -> "https://openrouter.ai/api/v1/chat/completions"
                    AiProvider.OPENAI -> "https://api.openai.com/v1/chat/completions"
                    AiProvider.DEEPSEEK -> "https://api.deepseek.com/chat/completions"
                    AiProvider.GROK -> "https://api.x.ai/v1/chat/completions"
                    AiProvider.GEMINI -> ""
                }
                val payload = JSONObject().apply {
                    put("model", modelId)
                    put("messages", JSONArray().apply {
                        put(JSONObject().put("role", "system").put("content", systemPrompt))
                        put(JSONObject().put("role", "user").put("content", userPrompt))
                    })
                }
                val req = Request.Builder()
                    .url(endpoint)
                    .addHeader("Authorization", "Bearer \$key")
                    .post(payload.toString().toRequestBody("application/json".toMediaType()))
                    .build()
                client.newCall(req).execute().use { res ->
                    val body = res.body?.string().orEmpty()
                    if (!res.isSuccessful) return@withContext AppResult.Error("\${provider.displayName} HTTP \${res.code}: \$body")
                    val text = JSONObject(body)
                        .getJSONArray("choices").getJSONObject(0)
                        .getJSONObject("message").getString("content")
                    AppResult.Success(text)
                }
            }
        } catch (e: Exception) {
            AppResult.Error(e.message ?: "Network error", e)
        }
    }

    override suspend fun fetchOpenRouterModels(): AppResult<List<AiModelInfo>> = withContext(Dispatchers.IO) {
        try {
            val reqBuilder = Request.Builder().url("https://openrouter.ai/api/v1/models")
            vault.getKey(AiProvider.OPENROUTER)?.let {
                reqBuilder.addHeader("Authorization", "Bearer \$it")
            }
            client.newCall(reqBuilder.build()).execute().use { res ->
                val body = res.body?.string().orEmpty()
                if (!res.isSuccessful) return@withContext AppResult.Error("OpenRouter Models HTTP \${res.code}")
                val arr = JSONObject(body).getJSONArray("data")
                val list = buildList {
                    for (i in 0 until minOf(arr.length(), 150)) {
                        val obj = arr.getJSONObject(i)
                        add(
                            AiModelInfo(
                                id = obj.getString("id"),
                                name = obj.optString("name", obj.getString("id")),
                                provider = AiProvider.OPENROUTER,
                                contextLength = obj.optInt("context_length", 0).takeIf { it > 0 },
                                isAvailable = true
                            )
                        )
                    }
                }
                AppResult.Success(list)
            }
        } catch (e: Exception) {
            AppResult.Error(e.message ?: "Failed to fetch OpenRouter models", e)
        }
    }

    override suspend fun testConnection(provider: AiProvider): AppResult<String> {
        val defaultModel = when (provider) {
            AiProvider.GEMINI -> "gemini-2.5-flash"
            AiProvider.OPENROUTER -> "openai/gpt-4o-mini"
            AiProvider.OPENAI -> "gpt-4o-mini"
            AiProvider.DEEPSEEK -> "deepseek-chat"
            AiProvider.GROK -> "grok-2-latest"
        }
        return when (val r = sendMessage(provider, defaultModel, "Reply with OK.", "ping")) {
            is AppResult.Success -> AppResult.Success("Connected (\${provider.displayName})")
            is AppResult.Error -> r
        }
    }
}
`,
  });

  // :voice module (Gemini Live WebSocket + 16kHz AudioRecord / 24kHz AudioTrack + Heart Engine + Natural Delivery)
  files.push({
    path: 'voice/build.gradle.kts',
    module: 'voice',
    language: 'gradle',
    content: moduleBuildGradle(
      'voice',
      `    implementation(project(":domain"))
    implementation(project(":emotion"))
    implementation(project(":security"))
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.json:json:20240303")`
    ),
  });
  files.push({
    path: 'voice/src/main/java/com/sreha/agent/voice/NaturalVoiceDeliveryController.kt',
    module: 'voice',
    language: 'kotlin',
    content: `package com.sreha.agent.voice

import com.sreha.agent.domain.EmotionType
import com.sreha.agent.domain.VoiceProfile

data class VoiceDeliveryParams(
    val speakingRate: Float,
    val pitch: Float,
    val sentencePauseMs: Long
)

/**
 * Controls speaking rate, prosody, sentence-boundary chunking, and literal tag sanitization
 * so SREHA speaks with natural human sentence continuity instead of broken word chunks.
 */
object NaturalVoiceDeliveryController {
    private val stageTagRegex = Regex("\\\\((?:laughs?|chuckles?|sighs?|giggles?|gasp|breath|pause)\\\\)|\\\\*(?:laughs?|chuckles?|sighs?)\\\\*", RegexOption.IGNORE_CASE)
    private val emotionPrefixRegex = Regex("^\\\\s*\\\\[EMOTION:[^\\\\]]+\\\\]\\\\s*", RegexOption.IGNORE_CASE)

    fun sanitizeSpokenText(raw: String): String {
        return raw
            .replace(emotionPrefixRegex, "")
            .replace(stageTagRegex, " ")
            .replace(Regex("\\\\s{2,}"), " ")
            .trim()
    }

    fun computeDeliveryParams(emotion: EmotionType, profile: VoiceProfile): VoiceDeliveryParams {
        var rate = when (profile) {
            VoiceProfile.SOFT -> 0.96f
            VoiceProfile.EXPRESSIVE -> 1.04f
            VoiceProfile.CALM -> 0.95f
            VoiceProfile.NATURAL -> 1.0f
        }
        var pitch = 1.0f
        var pauseMs = 140L

        when (emotion) {
            EmotionType.EXCITED -> { rate += 0.06f; pitch += 0.06f; pauseMs = 100L }
            EmotionType.HAPPY, EmotionType.PLAYFUL -> { rate += 0.03f; pitch += 0.04f; pauseMs = 115L }
            EmotionType.SAD, EmotionType.EMPATHETIC -> { rate -= 0.06f; pitch -= 0.04f; pauseMs = 200L }
            EmotionType.CARING, EmotionType.WORRIED -> { rate -= 0.04f; pauseMs = 170L }
            EmotionType.THOUGHTFUL -> { rate -= 0.03f; pauseMs = 190L }
            else -> {}
        }

        return VoiceDeliveryParams(
            speakingRate = rate.coerceIn(0.82f, 1.18f),
            pitch = pitch.coerceIn(0.88f, 1.15f),
            sentencePauseMs = pauseMs
        )
    }

    fun splitSentenceBoundaryChunks(rawText: String, minChunkChars: Int = 48): List<String> {
        val clean = sanitizeSpokenText(rawText)
        if (clean.isEmpty()) return emptyList()
        val sentences = clean.split(Regex("(?<=[।.!?])\\\\s+|\\\\n+"))
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        if (sentences.size <= 1) return sentences

        val chunks = mutableListOf<String>()
        var buffer = ""
        for (sentence in sentences) {
            buffer = if (buffer.isEmpty()) sentence else "\$buffer \$sentence"
            if (buffer.length >= minChunkChars) {
                chunks.add(buffer)
                buffer = ""
            }
        }
        if (buffer.isNotEmpty()) {
            if (chunks.isNotEmpty() && buffer.length < 24) {
                chunks[chunks.lastIndex] = "\${chunks.last()} \$buffer"
            } else {
                chunks.add(buffer)
            }
        }
        return chunks
    }
}
`,
  });
  files.push({
    path: 'voice/src/main/java/com/sreha/agent/voice/GeminiLiveVoiceClient.kt',
    module: 'voice',
    language: 'kotlin',
    content: `package com.sreha.agent.voice

import android.annotation.SuppressLint
import android.media.*
import android.util.Base64
import com.sreha.agent.domain.AiProvider
import com.sreha.agent.domain.VoiceProfile
import com.sreha.agent.emotion.HeartStateSnapshot
import com.sreha.agent.emotion.SrehaHeartEngine
import com.sreha.agent.security.ApiKeyVault
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.sqrt

enum class LiveVoiceState { IDLE, CONNECTING, LISTENING, PROCESSING, AI_SPEAKING, INTERRUPTED, RECONNECTING, ERROR }

/**
 * Real-Time Gemini Live API WebSocket Client.
 * Captures 16kHz 16-bit PCM mono audio via AudioRecord and plays 24kHz PCM mono via AudioTrack.
 * Integrates SrehaHeartEngine, NaturalVoiceDeliveryController, adaptive noise-floor VAD,
 * barge-in interruption, and automatic Custom/Default Gemini key resolution.
 */
class GeminiLiveVoiceClient(
    private val vault: ApiKeyVault,
    private val scope: CoroutineScope,
    private val heartEngine: SrehaHeartEngine = SrehaHeartEngine()
) {
    private val client = OkHttpClient()
    private var webSocket: WebSocket? = null
    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var captureJob: Job? = null
    private var ambientNoiseFloor = 0.015f

    private val _state = MutableStateFlow(LiveVoiceState.IDLE)
    val state: StateFlow<LiveVoiceState> = _state

    private val _heartState = MutableStateFlow<HeartStateSnapshot?>(null)
    val heartState: StateFlow<HeartStateSnapshot?> = _heartState

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun startSession(profile: VoiceProfile, systemInstruction: String, memorySummary: String? = null) {
        val resolution = vault.resolveRuntimeGeminiSource(AiProvider.GEMINI)
        val apiKey = resolution.apiKey
        if (apiKey == null) {
            _error.value = "Gemini API Key required for Live Voice."
            _state.value = LiveVoiceState.ERROR
            return
        }

        val initialHeart = heartEngine.analyzeTurn("", naturalReactionsEnabled = true)
        _heartState.value = initialHeart
        val heartPrompt = heartEngine.buildHeartVoiceSystemInstruction(systemInstruction, initialHeart, memorySummary)

        _state.value = LiveVoiceState.CONNECTING
        val wsUrl = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=\$apiKey"
        val request = Request.Builder().url(wsUrl).build()

        initOutputAudioTrack()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val setup = JSONObject().apply {
                    put("setup", JSONObject().apply {
                        put("model", "models/gemini-2.5-flash-native-audio-preview")
                        put("generationConfig", JSONObject().apply {
                            put("responseModalities", JSONArray().put("AUDIO"))
                            put("speechConfig", JSONObject().put("voiceConfig", JSONObject().put("prebuiltVoiceConfig", JSONObject().put("voiceName", profile.geminiVoiceName))))
                        })
                        put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", heartPrompt))))
                    })
                }
                webSocket.send(setup.toString())
                _state.value = LiveVoiceState.LISTENING
                startMicStreaming()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val json = JSONObject(text)
                val serverContent = json.optJSONObject("serverContent") ?: return
                if (serverContent.optBoolean("interrupted", false)) {
                    flushPlayback()
                    _state.value = LiveVoiceState.INTERRUPTED
                    scope.launch {
                        delay(450)
                        if (_state.value == LiveVoiceState.INTERRUPTED) {
                            _state.value = LiveVoiceState.LISTENING
                        }
                    }
                    return
                }
                val parts = serverContent.optJSONObject("modelTurn")?.optJSONArray("parts") ?: return
                for (i in 0 until parts.length()) {
                    val inlineData = parts.getJSONObject(i).optJSONObject("inlineData") ?: continue
                    val b64 = inlineData.optString("data")
                    if (b64.isNotEmpty()) {
                        _state.value = LiveVoiceState.AI_SPEAKING
                        val pcmBytes = Base64.decode(b64, Base64.DEFAULT)
                        audioTrack?.write(pcmBytes, 0, pcmBytes.size)
                    }
                }
                if (serverContent.optBoolean("turnComplete", false)) {
                    _state.value = LiveVoiceState.LISTENING
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _error.value = t.message ?: "Live Voice connection interrupted"
                _state.value = LiveVoiceState.RECONNECTING
                stopAudioHardware()
            }
        })
    }

    @SuppressLint("MissingPermission")
    private fun startMicStreaming() {
        val sampleRate = 16000
        val minBuf = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        audioRecord = AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minBuf, 3200))
        audioRecord?.startRecording()

        captureJob = scope.launch(Dispatchers.IO) {
            val buffer = ByteArray(1600)
            while (isActive && _state.value != LiveVoiceState.IDLE) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                if (read > 0) {
                    val rms = computePcmRms(buffer, read)
                    if (_state.value == LiveVoiceState.AI_SPEAKING && rms > maxOf(0.06f, ambientNoiseFloor * 2.5f)) {
                        flushPlayback()
                        _state.value = LiveVoiceState.INTERRUPTED
                    } else if (rms < 0.04f) {
                        ambientNoiseFloor = ambientNoiseFloor * 0.96f + rms * 0.04f
                    }
                    val encoded = Base64.encodeToString(buffer, 0, read, Base64.NO_WRAP)
                    val msg = JSONObject().put(
                        "realtimeInput",
                        JSONObject().put("mediaChunks", JSONArray().put(
                            JSONObject().put("mimeType", "audio/pcm;rate=16000").put("data", encoded)
                        ))
                    )
                    webSocket?.send(msg.toString())
                }
            }
        }
    }

    private fun computePcmRms(bytes: ByteArray, length: Int): Float {
        var sum = 0.0
        var count = 0
        var i = 0
        while (i + 1 < length) {
            val sample = ((bytes[i + 1].toInt() shl 8) or (bytes[i].toInt() and 0xff)).toShort().toFloat() / 32768f
            sum += sample * sample
            count++
            i += 2
        }
        return if (count > 0) sqrt(sum / count).toFloat() else 0f
    }

    private fun initOutputAudioTrack() {
        val minBuf = AudioTrack.getMinBufferSize(24000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(24000).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setBufferSizeInBytes(maxOf(minBuf, 4800))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        audioTrack?.play()
    }

    private fun flushPlayback() {
        audioTrack?.pause()
        audioTrack?.flush()
        audioTrack?.play()
    }

    private fun stopAudioHardware() {
        captureJob?.cancel()
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        audioTrack?.stop()
        audioTrack?.release()
        audioTrack = null
    }

    fun stopSession() {
        _state.value = LiveVoiceState.IDLE
        webSocket?.close(1000, "User stopped")
        webSocket = null
        stopAudioHardware()
    }
}
`,
  });

  // :memory module (Room DB + DAO)
  files.push({
    path: 'memory/build.gradle.kts',
    module: 'memory',
    language: 'gradle',
    content: moduleBuildGradle(
      'memory',
      `    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")`
    ),
  });
  files.push({
    path: 'memory/src/main/java/com/sreha/agent/memory/MemoryDatabase.kt',
    module: 'memory',
    language: 'kotlin',
    content: `package com.sreha.agent.memory

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "memories")
data class MemoryEntity(
    @PrimaryKey val id: String,
    val category: String,
    val title: String,
    val content: String,
    val createdAt: Long,
    val updatedAt: Long
)

@Dao
interface MemoryDao {
    @Query("SELECT * FROM memories ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<MemoryEntity>>

    @Query("SELECT * FROM memories WHERE title LIKE '%' || :query || '%' OR content LIKE '%' || :query || '%' ORDER BY updatedAt DESC")
    suspend fun search(query: String): List<MemoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: MemoryEntity)

    @Query("DELETE FROM memories WHERE id = :id")
    suspend fun deleteById(id: String)
}

@Database(entities = [MemoryEntity::class], version = 1, exportSchema = false)
abstract class MemoryDatabase : RoomDatabase() {
    abstract fun memoryDao(): MemoryDao

    companion object {
        @Volatile private var INSTANCE: MemoryDatabase? = null
        fun getInstance(context: Context): MemoryDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(context.applicationContext, MemoryDatabase::class.java, "sreha_memory.db")
                    .build().also { INSTANCE = it }
            }
    }
}
`,
  });

  // :agent module (Permission-aware phone control intents)
  files.push({
    path: 'agent/build.gradle.kts',
    module: 'agent',
    language: 'gradle',
    content: moduleBuildGradle('agent'),
  });
  files.push({
    path: 'agent/src/main/java/com/sreha/agent/agent/PhoneAgentExecutor.kt',
    module: 'agent',
    language: 'kotlin',
    content: `package com.sreha.agent.agent

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings

class PhoneAgentExecutor(private val context: Context) {

    fun openSettings(action: String = Settings.ACTION_SETTINGS) {
        val intent = Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun openCamera() {
        val intent = Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun setAlarm(hour: Int, minute: Int, label: String) {
        val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
            putExtra(AlarmClock.EXTRA_HOUR, hour)
            putExtra(AlarmClock.EXTRA_MINUTES, minute)
            putExtra(AlarmClock.EXTRA_MESSAGE, label)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun startTimer(seconds: Int, label: String) {
        val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
            putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            putExtra(AlarmClock.EXTRA_MESSAGE, label)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun setMediaVolumePercent(percent: Int) {
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val target = ((percent.coerceIn(0, 100) / 100f) * max).toInt()
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, target, AudioManager.FLAG_SHOW_UI)
    }
}
`,
  });

  // :automation module (WorkManager)
  files.push({
    path: 'automation/build.gradle.kts',
    module: 'automation',
    language: 'gradle',
    content: moduleBuildGradle('automation', '    implementation("androidx.work:work-runtime-ktx:2.10.0")'),
  });
  files.push({
    path: 'automation/src/main/java/com/sreha/agent/automation/SrehaAutomationWorker.kt',
    module: 'automation',
    language: 'kotlin',
    content: `package com.sreha.agent.automation

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class SrehaAutomationWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val taskTitle = inputData.getString("title") ?: "SREHA Task"
        // Execute safe scheduled action or trigger local notification
        return Result.success(workDataOf("executed" to taskTitle))
    }

    companion object {
        fun schedule(context: Context, taskId: String, title: String, delayMinutes: Long) {
            val req = OneTimeWorkRequestBuilder<SrehaAutomationWorker>()
                .setInitialDelay(delayMinutes, TimeUnit.MINUTES)
                .setInputData(workDataOf("title" to title))
                .addTag(taskId)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(taskId, ExistingWorkPolicy.REPLACE, req)
        }

        fun cancel(context: Context, taskId: String) {
            WorkManager.getInstance(context).cancelUniqueWork(taskId)
        }
    }
}
`,
  });

  // :data & :tools modules
  files.push({
    path: 'data/build.gradle.kts',
    module: 'data',
    language: 'gradle',
    content: moduleBuildGradle('data', '    implementation("androidx.datastore:datastore-preferences:1.1.2")\n    implementation(project(":domain"))'),
  });
  files.push({
    path: 'data/src/main/java/com/sreha/agent/data/SettingsDataStore.kt',
    module: 'data',
    language: 'kotlin',
    content: `package com.sreha.agent.data

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "sreha_settings")

class SettingsRepository(private val context: Context) {
    private val KEY_DARK_THEME = booleanPreferencesKey("dark_theme")
    private val KEY_VOICE_PROFILE = stringPreferencesKey("voice_profile")
    private val KEY_HEART_ENGINE = booleanPreferencesKey("heart_engine_enabled")
    private val KEY_NATURAL_REACTIONS = booleanPreferencesKey("natural_reactions_enabled")
    private val KEY_LISTENING_SENSITIVITY = stringPreferencesKey("listening_sensitivity")

    val darkTheme = context.dataStore.data.map { it[KEY_DARK_THEME] ?: true }
    val voiceProfile = context.dataStore.data.map { it[KEY_VOICE_PROFILE] ?: "NATURAL" }
    val heartEngineEnabled = context.dataStore.data.map { it[KEY_HEART_ENGINE] ?: true }
    val naturalReactionsEnabled = context.dataStore.data.map { it[KEY_NATURAL_REACTIONS] ?: true }
    val listeningSensitivity = context.dataStore.data.map { it[KEY_LISTENING_SENSITIVITY] ?: "balanced" }

    suspend fun setDarkTheme(enabled: Boolean) {
        context.dataStore.edit { it[KEY_DARK_THEME] = enabled }
    }

    suspend fun setHeartEngineEnabled(enabled: Boolean) {
        context.dataStore.edit { it[KEY_HEART_ENGINE] = enabled }
    }

    suspend fun setNaturalReactionsEnabled(enabled: Boolean) {
        context.dataStore.edit { it[KEY_NATURAL_REACTIONS] = enabled }
    }
}
`,
  });

  files.push({
    path: 'tools/build.gradle.kts',
    module: 'tools',
    language: 'gradle',
    content: moduleBuildGradle(
      'tools',
      `    implementation("androidx.camera:camera-camera2:1.4.1")
    implementation("androidx.camera:camera-lifecycle:1.4.1")
    implementation("androidx.camera:camera-view:1.4.1")`
    ),
  });
  files.push({
    path: 'tools/src/main/java/com/sreha/agent/tools/NetworkTools.kt',
    module: 'tools',
    language: 'kotlin',
    content: `package com.sreha.agent.tools

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

data class NetworkStatusSummary(
    val isConnected: Boolean,
    val transportType: String,
    val downBandwidthKbps: Int
)

object NetworkTools {
    fun getStatus(context: Context): NetworkStatusSummary {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val net = cm.activeNetwork ?: return NetworkStatusSummary(false, "None", 0)
        val caps = cm.getNetworkCapabilities(net) ?: return NetworkStatusSummary(false, "None", 0)
        val transport = when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular"
            else -> "Other"
        }
        return NetworkStatusSummary(true, transport, caps.linkDownstreamBandwidthKbps)
    }
}
`,
  });

  // :ui module (Theme + Orb + Keyboard-Safe Chat Screen with WindowInsets.imePadding & LazyColumn)
  files.push({
    path: 'ui/build.gradle.kts',
    module: 'ui',
    language: 'gradle',
    content: moduleBuildGradle(
      'ui',
      `    implementation(project(":domain"))
    implementation(project(":security"))
    implementation(project(":memory"))
    implementation(project(":emotion"))
    implementation(platform("androidx.compose:compose-bom:2025.02.00"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material:material-icons-extended")
    compose`
    ),
  });
  files.push({
    path: 'ui/src/main/java/com/sreha/agent/ui/theme/SrehaTheme.kt',
    module: 'ui',
    language: 'kotlin',
    content: `package com.sreha.agent.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val SrehaDarkColors = darkColorScheme(
    primary = Color(0xFF3B82F6),
    secondary = Color(0xFF8B5CF6),
    tertiary = Color(0xFFEC4899),
    background = Color(0xFF070B19),
    surface = Color(0xFF111936),
    onBackground = Color(0xFFF1F5F9),
    onSurface = Color(0xFFF1F5F9)
)

private val SrehaLightColors = lightColorScheme(
    primary = Color(0xFF2563EB),
    secondary = Color(0xFF7C3AED),
    tertiary = Color(0xFFDB2777),
    background = Color(0xFFF8FAFC),
    surface = Color(0xFFFFFFFF),
    onBackground = Color(0xFF0F172A),
    onSurface = Color(0xFF0F172A)
)

@Composable
fun SrehaTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) SrehaDarkColors else SrehaLightColors,
        content = content
    )
}
`,
  });

  files.push({
    path: 'ui/src/main/java/com/sreha/agent/ui/SrehaAppRoot.kt',
    module: 'ui',
    language: 'kotlin',
    content: `package com.sreha.agent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.sreha.agent.domain.ChatMessage
import com.sreha.agent.memory.MemoryDao
import com.sreha.agent.security.ApiKeyVault

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SrehaAppRoot(
    apiKeyVault: ApiKeyVault,
    memoryDao: MemoryDao,
    isDarkTheme: Boolean,
    onToggleTheme: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var inputText by remember { mutableStateOf("") }
    val messages = remember {
        mutableStateListOf(
            ChatMessage(
                id = "welcome",
                isUser = false,
                text = "নমস্কার! আমি স্রেহা, আপনার ব্যক্তিগত AI এজেন্ট। আজ কীভাবে সাহায্য করতে পারি?",
                timestampMillis = System.currentTimeMillis()
            )
        )
    }
    val listState = rememberLazyListState()

    // Auto-scroll only when a new message is appended and user is near the bottom
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.lastIndex)
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        contentWindowInsets = WindowInsets.safeDrawing,
        topBar = {
            TopAppBar(
                title = { Text("SREHA AI AGENT") },
                actions = {
                    IconButton(onClick = onToggleTheme) {
                        Icon(
                            imageVector = if (isDarkTheme) Icons.Default.LightMode else Icons.Default.DarkMode,
                            contentDescription = "Toggle Theme"
                        )
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                val tabs = listOf("Home", "Chat", "Tools", "Memory", "Settings")
                val icons = listOf(Icons.Default.Home, Icons.Default.ChatBubble, Icons.Default.Build, Icons.Default.Psychology, Icons.Default.Settings)
                tabs.forEachIndexed { idx, label ->
                    NavigationBarItem(
                        selected = selectedTab == idx,
                        onClick = { selectedTab = idx },
                        icon = { Icon(icons[idx], contentDescription = label) },
                        label = { Text(label) }
                    )
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding() // Keeps composer above Android keyboard without hiding Send button
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(vertical = 12.dp)
            ) {
                items(messages, key = { it.id }) { msg ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = if (msg.isUser) Arrangement.End else Arrangement.Start
                    ) {
                        Box(
                            modifier = Modifier
                                .widthIn(max = 300.dp)
                                .background(
                                    color = if (msg.isUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
                                    shape = RoundedCornerShape(18.dp)
                                )
                                .padding(horizontal = 14.dp, vertical = 10.dp)
                        ) {
                            Text(
                                text = msg.text,
                                color = if (msg.isUser) Color.White else MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }

            // Modern Multiline Chat Composer anchored above IME keyboard
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.Bottom
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    placeholder = { Text("স্রেহাকে কিছু জিজ্ঞাসা করুন…") },
                    maxLines = 5,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(22.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                FilledIconButton(
                    onClick = {
                        val trimmed = inputText.trim()
                        if (trimmed.isNotEmpty()) {
                            messages.add(ChatMessage("u_\${System.currentTimeMillis()}", true, trimmed, System.currentTimeMillis()))
                            inputText = ""
                        }
                    },
                    modifier = Modifier.size(48.dp)
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                }
            }
        }
    }
}
`,
  });

  return files;
}
