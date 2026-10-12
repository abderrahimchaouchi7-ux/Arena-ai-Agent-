# Building the Android APK

The `android/` directory is a **real Capacitor 6 Android project** — Gradle
build files, manifest, launcher icons, notification channels and a configured
signing block. It is checked into the repository.

> **Status of this document's claims.** The project in this repository was
> generated and configured, but **no APK was built, signed or tested** in the
> environment where it was authored: that sandbox has no JDK, no Gradle and no
> Android SDK. The instructions below are the exact steps to produce the
> artefact on a machine that has them. Nothing here asserts that a build was run.

---

## 1. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| JDK | **17** | `java -version` |
| Android SDK | Platform **34**, Build-Tools 34.x | `sdkmanager --list` |
| Node.js | 18+ | `node -v` |
| Gradle | Provided by the wrapper — do not install separately | `./gradlew -v` |

`android/variables.gradle` pins `compileSdkVersion = 34`,
`targetSdkVersion = 34`, `minSdkVersion = 22` (Android 5.1+).

Set `ANDROID_HOME` (or create `android/local.properties`):

```bash
sdk.dir=/path/to/Android/sdk
```

`local.properties` is git-ignored.

---

## 2. Debug build (fastest path to an installable APK)

```bash
npm ci
npm run data:verify        # 13 release-gating checks on the bundled content
npm run build              # tsc --noEmit && vite build  → dist/
npx cap sync android       # copies dist/ + plugins into the Android project
cd android
./gradlew assembleDebug
```

Output:

```
android/app/build/outputs/apk/debug/nur-al-iman-1.0-debug.apk
```

Install it:

```bash
adb install -r android/app/build/outputs/apk/debug/nur-al-iman-1.0-debug.apk
```

A debug APK is signed with the debug keystore. It installs and runs, but it is
**not** suitable for distribution and cannot be upgraded to a release build.

---

## 3. Release build (distributable)

### 3.1 Generate a signing key — once, and keep it safe

Losing this key means you can never update the published app.

```bash
cd android
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias nur-al-iman \
  -keyalg RSA -keysize 2048 -validity 10000
```

### 3.2 Record the credentials — outside version control

Create `android/keystore.properties`:

```properties
storeFile=release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=nur-al-iman
keyPassword=YOUR_KEY_PASSWORD
```

Both `*.keystore` and `keystore.properties` are in `.gitignore`. **Never commit
either.** If `keystore.properties` is absent, `android/app/build.gradle` falls
back to the debug key and logs a warning, so CI still produces an artefact.

### 3.3 Build

```bash
npm ci && npm run data:verify && npm run build && npx cap sync android
cd android
./gradlew assembleRelease
```

Output:

```
android/app/build/outputs/apk/release/nur-al-iman-1.0-release.apk
```

Verify the signature before distributing:

```bash
apksigner verify --verbose --print-certs \
  android/app/build/outputs/apk/release/nur-al-iman-1.0-release.apk
```

### 3.4 Google Play bundle

Play requires an `.aab`, not an `.apk`:

```bash
cd android && ./gradlew bundleRelease
# android/app/build/outputs/bundle/release/app-release.aab
```

---

## 4. Reproducible builds

For a byte-comparable release, pin every input:

```bash
# 1. Clean checkout, pinned dependencies.
git clone <repo> && cd Arena-ai-Agent- && git checkout <tag>
npm ci                       # honours package-lock.json exactly

# 2. Rebuild content from the pinned upstream commits.
npm run data:build           # uses .data-cache/ if present, else re-fetches
npm run data:verify          # must print 13/13 PASS

# 3. Deterministic web bundle.
npm run build

# 4. Native build with a fixed toolchain and no daemon state.
cd android
./gradlew --no-daemon --no-build-cache clean assembleRelease
```

Two further inputs still vary unless you control them:

- **Timestamps.** Gradle embeds build times in some resources. Set
  `SOURCE_DATE_EPOCH` and run with `--no-daemon` for the closest match.
- **Keystore.** The same `release.keystore` must be used, or signatures differ.

Treat "reproducible" as *reproducible given the same key and toolchain*.

---

## 5. App configuration

| Setting | Value | File |
| --- | --- | --- |
| Application ID | `org.nuraliman.app` | `capacitor.config.ts`, `android/app/build.gradle` |
| App name | Nur Al-Iman | `android/app/src/main/res/values/strings.xml` |
| versionName | `1.0` | `android/app/build.gradle` |
| versionCode | `1` | `android/app/build.gradle` |
| minSdk / target | 22 / 34 | `android/variables.gradle` |
| Launcher icon | All 5 densities + adaptive | `android/app/src/main/res/mipmap-*` |

Bump `versionCode` (integer, must increase) and `versionName` (user-facing) in
`android/app/build.gradle` for every release. `npm run android:sync` re-runs the
web build and copies it in, so always sync before building.

---

## 6. Permissions and why each is needed

Declared in `android/app/src/main/AndroidManifest.xml`:

| Permission | Why | If denied |
| --- | --- | --- |
| `INTERNET` | Stream adhan audio; optional full hadith downloads | Everything else works offline |
| `ACCESS_COARSE_LOCATION` | Compute prayer times and Qibla from real coordinates | Manual city or typed coordinates |
| `POST_NOTIFICATIONS` | Prayer alerts (Android 13+) | App works; alerts suppressed |
| `SCHEDULE_EXACT_ALARM` | Alert at the exact prayer time (Android 14+) | Falls back to inexact timing |
| `USE_EXACT_ALARM` | Exact timing for alarm-class apps | As above |
| `RECEIVE_BOOT_COMPLETED` | Re-arm reminders after a reboot | Reminders lost until app opens |
| `VIBRATE`, `WAKE_LOCK` | Alert feedback; delivery while dozing | Silent / delayed alerts |

Compass and location hardware are declared `required="false"`, so the app
installs on devices without a magnetometer and degrades to the computed
geographic bearing.

Location is **coarse** deliberately: the maths needs city-level accuracy, not a
precise fix. Coordinates are never uploaded.

---

## 7. Notification channels

`MainActivity.onCreate` creates two channels on Android 8+, because notifications
posted to an unknown channel are silently dropped:

| Channel ID | Importance | Purpose |
| --- | --- | --- |
| `prayer-times` | HIGH (4) | The prayer-time alert itself |
| `prayer-reminders` | DEFAULT (3) | Pre-prayer reminders |

HIGH is chosen over MAX so the alert is audible and heads-up **without**
bypassing Do Not Disturb unless the user opts in per prayer.

---

## 8. Known platform limits — stated honestly

These are OS behaviours, not bugs, and the app explains them in Settings:

- **A closed tab cannot fire a notification.** On the web, the scheduler runs
  in-page and is rebuilt on load and on config change. Only the native Android
  build can schedule alerts that fire while the app is closed.
- **Android may freeze background JS.** Doze and App Standby defer timers. The
  native path uses `AlarmManager` via `@capacitor/local-notifications`, which is
  why the Android build is the supported way to rely on prayer alerts.
- **Battery optimisation can still delay alerts.** The user may need to exempt
  the app; the Settings screen says so rather than promising unrestricted
  operation.
- **Background audio playback** continues only while the WebView holds the audio
  session. A full media-session service is a native addition, not a web
  capability.

---

## 9. Useful commands

```bash
npm run android:add       # regenerate the android/ project from scratch
npm run android:sync      # build web + copy into android/ + update plugins
npm run android:open      # open in Android Studio
npm run android:apk       # ./gradlew assembleDebug
npm run android:bundle    # ./gradlew bundleRelease
./scripts/make-icons.sh   # regenerate every icon density from branding/app-icon.png
```
