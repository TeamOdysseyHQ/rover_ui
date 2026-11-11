#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/.local/opt/android-sdk}}"
android_jar="$sdk_root/platforms/android-35/android.jar"
tools_dir="$sdk_root/build-tools/35.0.0"
if [[ ! -f "$android_jar" || ! -x "$tools_dir/aapt2" ]]; then
    echo 'Install Android SDK platform 35 and build-tools 35.0.0, then set ANDROID_SDK_ROOT.' >&2
    exit 1
fi
mkdir -p build/classes build/dex ../../.local
find src -name '*.java' -print > build/sources.txt
javac --release 8 -classpath "$android_jar" -d build/classes @build/sources.txt
"$tools_dir/aapt2" link -I "$android_jar" --manifest AndroidManifest.xml -o build/unsigned.apk
find build/classes -name '*.class' -print > build/classes.txt
"$tools_dir/d8" --min-api 26 --lib "$android_jar" --output build/dex @build/classes.txt
(cd build/dex && zip -q -u ../unsigned.apk classes.dex)
"$tools_dir/zipalign" -f 4 build/unsigned.apk build/aligned.apk
key_path="../../.local/phone-debug.keystore"
if [[ ! -f "$key_path" ]]; then
    keytool -genkeypair -keystore "$key_path" -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug' >/dev/null 2>&1
fi
"$tools_dir/apksigner" sign --ks "$key_path" --ks-key-alias androiddebugkey --ks-pass pass:android --out build/rover-joystick.apk build/aligned.apk
"$tools_dir/apksigner" verify build/rover-joystick.apk
printf 'APK: %s/build/rover-joystick.apk\n' "$PWD"
