#!/bin/bash
# LifeOS Health Module: download (first run), update (later runs) and start.
# Double-click on macOS. First time: run `chmod +x HealthModule.command` in Terminal if macOS says it can't be opened.

REPO="https://github.com/MysticalMayfly/Health-Module.git"
DIR="$HOME/Health-Module"
PORT=3001

set -e
cd "$HOME"

# 1. Node.js 22.5+ is required (it has SQLite built in)
need_node() {
  command -v node >/dev/null 2>&1 || return 0
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=5)?1:0)'
}
if need_node; then
  echo "Node.js 22.5 or newer is required."
  if command -v brew >/dev/null 2>&1; then
    echo "Installing it with Homebrew…"
    brew install node
  else
    echo "Install it from https://nodejs.org (choose the LTS version), then double-click this file again."
    open "https://nodejs.org"
    read -n 1 -s -r -p "Press any key to close…"
    exit 1
  fi
fi

# 2. Clone the first time, pull updates afterwards
if [ -d "$DIR/.git" ]; then
  echo "Updating Health Module…"
  git -C "$DIR" pull --ff-only || echo "Couldn't update. Starting the version you already have."
else
  echo "Downloading Health Module…"
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

# 3. Install, build and start
echo "Installing dependencies (the first run takes a minute)…"
npm install --no-fund --no-audit
echo "Building…"
npm run build

# Open the browser once the server is up
( until curl -s "http://localhost:$PORT/api/settings" >/dev/null; do sleep 1; done; open "http://localhost:$PORT" ) &

echo ""
echo "Health Module is running at http://localhost:$PORT"
echo "Keep this window open while you use it. Close it (or press Ctrl+C) to stop."
echo ""
NODE_ENV=production PORT=$PORT node --no-warnings server/index.js
