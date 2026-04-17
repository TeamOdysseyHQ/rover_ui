import os

slot_file = "src/lib/components/panels/FullscreenCameraSlot.svelte"
with open(slot_file, 'r') as f:
    content = f.read()
    
content = content.replace("let { \n    slot = $bindable(),", "let { \n    config = $bindable(),")
content = content.replace("slot.", "config.")
content = content.replace("slot ", "config ")
content = content.replace("!config.isConfigured", "!config.isConfigured")

with open(slot_file, 'w') as f:
    f.write(content)

view_file = "src/lib/components/panels/FullscreenCameraView.svelte"
with open(view_file, 'r') as f:
    content = f.read()

content = content.replace("bind:slot={$fullscreenSlots[i]}", "bind:config={$fullscreenSlots[i]}")

with open(view_file, 'w') as f:
    f.write(content)

print("Renamed slot to config.")
