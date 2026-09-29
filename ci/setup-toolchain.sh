#!/usr/bin/env bash
# Install the pinned scriptc toolchain and apply the local compiler patches.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf .toolchain
mkdir -p .toolchain
cp ci/toolchain/package.json .toolchain/package.json
( cd .toolchain && npm install --no-audit --no-fund )

COMPILER_DIST=.toolchain/node_modules/@scriptc/compiler/dist
cp ci/toolchain/patched/report.js "$COMPILER_DIST/coverage/report.js"
cp ci/toolchain/patched/lower-exprs.js "$COMPILER_DIST/frontend/lowering/lower-exprs.js"

# Known hazard: npm recreates a nested node_modules/scriptc/node_modules (bundled
# old copy) that hijacks module resolution — remove it whenever it appears.
rm -rf .toolchain/node_modules/scriptc/node_modules

node .toolchain/node_modules/.bin/scriptc --version || true
echo "toolchain ready"
