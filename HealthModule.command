#!/bin/bash
# LifeOS Health Module launcher (macOS; also works on Linux).
# Needs nothing pre-installed: it downloads the app and a private copy of Node.js into ~/Health-Module.
# Your data lives in ~/Health-Module/data and is kept across updates.
#
# If double-clicking does nothing or says "permission denied", open Terminal and run:
#   bash ~/Downloads/HealthModule.command

ZIP_URL="https://github.com/MysticalMayfly/health-module/archive/refs/heads/main.zip"
NODE_VERSION="22.22.0"
HOME_DIR="$HOME/Health-Module"
APP="$HOME_DIR/app"
PORT=3001

fail() {
  echo ""
  echo "❌ $1"
  echo "Take a screenshot of this window and share it so the problem can be fixed."
  read -n 1 -s -r -p "Press any key to close…"
  exit 1
}
trap 'fail "Something went wrong on line $LINENO."' ERR
set -eE

mkdir -p "$HOME_DIR/data"
cd "$HOME_DIR"

# 1. Node.js: use the system one if it's 22.13+, otherwise download a private copy (no admin rights needed)
node_ok() { "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' 2>/dev/null; }
NODE_BIN=""
if command -v node >/dev/null 2>&1 && node_ok node; then
  NODE_BIN="$(dirname "$(command -v node)")"
else
  case "$(uname -s)" in Darwin) OS=darwin ;; Linux) OS=linux ;; *) fail "Unsupported system: $(uname -s)" ;; esac
  case "$(uname -m)" in arm64|aarch64) ARCH=arm64 ;; x86_64) ARCH=x64 ;; *) fail "Unsupported processor: $(uname -m)" ;; esac
  NODE_DIR="$HOME_DIR/node-v$NODE_VERSION-$OS-$ARCH"
  if [ ! -x "$NODE_DIR/bin/node" ]; then
    echo "⬇️  Downloading Node.js $NODE_VERSION (one time only)…"
    curl -fL --progress-bar "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$OS-$ARCH.tar.gz" -o node.tar.gz || fail "Couldn't download Node.js. Check your internet connection."
    tar -xzf node.tar.gz && rm node.tar.gz
  fi
  NODE_BIN="$NODE_DIR/bin"
fi
export PATH="$NODE_BIN:$PATH"
echo "✅ Node.js $(node -v)"

# 2. Download the latest app (no git needed). Your data folder is never touched.
echo "⬇️  Downloading the latest Health Module…"
if curl -fsSL "$ZIP_URL" -o app.zip; then
  rm -rf app.new && mkdir app.new
  unzip -q app.zip -d app.new && rm app.zip
  SRC="$(find app.new -mindepth 1 -maxdepth 1 -type d | head -1)"
  if [ -d "$APP/node_modules" ]; then mv "$APP/node_modules" "$SRC/node_modules"; fi
  rm -rf "$APP" && mv "$SRC" "$APP" && rm -rf app.new
elif [ -d "$APP" ]; then
  echo "⚠️  Couldn't download an update. Starting the version you already have."
else
  fail "Couldn't download the app. Check your internet connection."
fi
cd "$APP"

# 3. Install, build, start
echo "📦 Installing dependencies (the first run takes a minute or two)…"
npm install --no-fund --no-audit --loglevel=error
echo "🛠  Building…"
npm run build --silent > /dev/null

# Stop an older copy that's still running on the same port
if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:$PORT >/dev/null 2>&1; then
  echo "Stopping the copy that was already running…"
  kill $(lsof -ti tcp:$PORT) 2>/dev/null || true
  sleep 1
fi

OPEN=open; command -v open >/dev/null 2>&1 || OPEN=xdg-open
( trap - ERR; set +e; for i in $(seq 1 60); do curl -s "http://localhost:$PORT/api/settings" >/dev/null 2>&1 && { $OPEN "http://localhost:$PORT" >/dev/null 2>&1; break; }; sleep 1; done ) &

trap - ERR
echo ""
echo "🚀 Health Module is running at http://localhost:$PORT"
echo "   Keep this window open while you use it. Close it (or press Ctrl+C) to stop."
echo "   Your data: $HOME_DIR/data"
echo ""
NODE_ENV=production PORT=$PORT LIFEOS_DATA="$HOME_DIR/data" node --experimental-sqlite --no-warnings server/index.js || fail "The server stopped unexpectedly."
