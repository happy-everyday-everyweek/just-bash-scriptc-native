#!/usr/bin/env bash
# Install the pinned scriptc toolchain and apply the local compiler patches.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf .toolchain
mkdir -p .toolchain
cp ci/toolchain/package.json .toolchain/package.json
cp ci/toolchain/package-lock.json .toolchain/package-lock.json
( cd .toolchain && npm ci --no-audit --no-fund )

COMPILER_DIST=.toolchain/node_modules/@scriptc/compiler/dist
cp ci/toolchain/patched/report.js "$COMPILER_DIST/coverage/report.js"
cp ci/toolchain/patched/lower-exprs.js "$COMPILER_DIST/frontend/lowering/lower-exprs.js"

# Known hazard: a nested node_modules/scriptc/node_modules hijacks the runtime.
if [ -d .toolchain/node_modules/scriptc/node_modules ]; then
  echo "FATAL: nested node_modules/scriptc/node_modules detected" >&2
  exit 1
fi

node .toolchain/node_modules/.bin/scriptc --version || true
echo "toolchain ready"
