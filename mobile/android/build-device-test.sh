#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/.local/opt/android-sdk}}"
android_jar="$sdk_root/platforms/android-35/android.jar"
tools_dir="$sdk_root/build-tools/35.0.0"
mkdir -p build/device-test/classes build/device-test/dex
javac --release 8 -classpath "$android_jar" -d build/device-test/classes device-test/org/skanda/roverjoystick/test/JoystickInstrumentation.java
"$tools_dir/aapt2" link -I "$android_jar" --manifest device-test/AndroidManifest.xml -o build/device-test/unsigned.apk
find build/device-test/classes -name '*.class' -print > build/device-test/classes.txt
"$tools_dir/d8" --min-api 26 --lib "$android_jar" --output build/device-test/dex @build/device-test/classes.txt
(cd build/device-test/dex && zip -q -u ../unsigned.apk classes.dex)
"$tools_dir/zipalign" -f 4 build/device-test/unsigned.apk build/device-test/aligned.apk
"$tools_dir/apksigner" sign --ks ../../.local/phone-debug.keystore --ks-key-alias androiddebugkey --ks-pass pass:android --out build/rover-joystick-tests.apk build/device-test/aligned.apk
