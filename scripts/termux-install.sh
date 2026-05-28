#!/bin/bash
# Termux installer for pentem CLI
# Usage: curl -fsSL https://raw.githubusercontent.com/zkaeshjm/pentem/main/scripts/termux-install.sh | bash

set -e

echo "=== Pentem Termux Installer ==="
echo ""

PENTEM_DIR="$PREFIX/opt/pentem"
REPO="zkaeshjm/pentem"

# Step 1: Check Termux environment
echo "[1/5] Checking environment..."
if [ -z "$PREFIX" ]; then
  echo "Error: This script must run inside Termux on Android."
  exit 1
fi

# Step 2: Install dependencies
echo "[2/5] Installing dependencies..."
pkg update -y
pkg install -y nodejs git curl

# Step 3: Install pentem via npm
echo "[3/5] Installing pentem..."
npm install -g pentem-pentest

# Step 4: Create convenience script
echo "[4/5] Setting up..."
mkdir -p "$PENTEM_DIR"
cat > "$PREFIX/bin/pentem" << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
NODE_PATH=$(npm root -g) node -e "require('pentem-pentest')" "$@"
EOF
chmod +x "$PREFIX/bin/pentem"

# Step 5: Verify
echo "[5/5] Verifying..."
pentem --help

echo ""
echo "=== pentem installed successfully! ==="
echo "  Run: pentem --help"
