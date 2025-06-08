#!/bin/bash

TARGET="$(realpath ./index.html)"
ICON="$(realpath ./favicon.ico)"
OUTPUT="$HOME/Desktop/easy-notes.desktop"

cat > "$OUTPUT" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Easy Notes
Exec=xdg-open "$TARGET"
Icon=$ICON
Terminal=false
Categories=Utility;
EOF

chmod +x "$OUTPUT"

echo "Shortcut created on desktop: Easy Notes"
