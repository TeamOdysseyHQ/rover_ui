#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build/test-classes
javac -d build/test-classes src/org/skanda/roverjoystick/JoystickState.java test/org/skanda/roverjoystick/JoystickStateTest.java
java -ea -cp build/test-classes org.skanda.roverjoystick.JoystickStateTest
