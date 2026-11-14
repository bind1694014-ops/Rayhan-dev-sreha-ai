import test from 'node:test';
import assert from 'node:assert/strict';
import { ANDROID_MODULES, generateAndroidProjectFiles } from './androidProjectGenerator';

test('generateAndroidProjectFiles includes all 13 Gradle modules and root build files', () => {
  const files = generateAndroidProjectFiles();
  const paths = new Set(files.map((f) => f.path));

  for (const mod of ANDROID_MODULES) {
    assert.ok(paths.has(`${mod}/build.gradle.kts`), `Missing ${mod}/build.gradle.kts`);
  }

  for (const required of [
    'settings.gradle.kts',
    'build.gradle.kts',
    'gradle.properties',
    'gradlew.bat',
    'gradle/wrapper/gradle-wrapper.properties',
    'BUILD.bat',
    'README-BN.md',
    'app/src/main/AndroidManifest.xml',
    'app/src/main/java/com/sreha/agent/MainActivity.kt',
    'security/src/main/java/com/sreha/agent/security/ApiKeyVault.kt',
    'emotion/src/main/java/com/sreha/agent/emotion/SrehaHeartEngine.kt',
    'emotion/src/main/java/com/sreha/agent/emotion/NaturalConversationEngine.kt',
    'voice/src/main/java/com/sreha/agent/voice/GeminiLiveVoiceClient.kt',
    'voice/src/main/java/com/sreha/agent/voice/NaturalVoiceDeliveryController.kt',
    'memory/src/main/java/com/sreha/agent/memory/MemoryDatabase.kt',
    'ui/src/main/java/com/sreha/agent/ui/SrehaAppRoot.kt',
  ]) {
    const found = files.find((f) => f.path === required);
    assert.ok(found, `Missing required file: ${required}`);
    assert.ok(found.content.trim().length > 40, `File too short: ${required}`);
  }
});

test('Android Chat UI uses WindowInsets imePadding and LazyColumn', () => {
  const files = generateAndroidProjectFiles();
  const uiFile = files.find((f) => f.path === 'ui/src/main/java/com/sreha/agent/ui/SrehaAppRoot.kt');
  assert.ok(uiFile);
  assert.match(uiFile.content, /imePadding\(\)/);
  assert.match(uiFile.content, /LazyColumn/);
  assert.match(uiFile.content, /rememberLazyListState/);
});

test('Android Vault & Voice include Separate Custom Gemini Priority and Heart Engine', () => {
  const files = generateAndroidProjectFiles();
  const vaultFile = files.find((f) => f.path === 'security/src/main/java/com/sreha/agent/security/ApiKeyVault.kt');
  const voiceFile = files.find((f) => f.path === 'voice/src/main/java/com/sreha/agent/voice/GeminiLiveVoiceClient.kt');
  assert.ok(vaultFile && voiceFile);
  assert.match(vaultFile.content, /resolveRuntimeGeminiSource/);
  assert.match(vaultFile.content, /VALID_CUSTOM_GEMINI/);
  assert.match(voiceFile.content, /SrehaHeartEngine/);
  assert.match(voiceFile.content, /INTERRUPTED/);
});

