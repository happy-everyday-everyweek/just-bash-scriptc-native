#!/usr/bin/env bash
# Run the scriptc exe-lane build for just-bash, capture the log, report the SC error count.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p ci-out
cd packages/just-bash
node ../../.toolchain/node_modules/.bin/scriptc build \
  src/devprobe/entry-exe.ts --optimization dev -o ../../ci-out/just-bash \
  2>&1 | tee ../../ci-out/build.log
rc=${PIPESTATUS[0]}
echo "== scriptc exit code: $rc"
echo "== error count: $(grep -cE 'error SC' ../../ci-out/build.log)"
if [ -x ../../ci-out/just-bash ]; then
  echo "== smoke run =="
  timeout 120 ../../ci-out/just-bash || echo "smoke rc=$?"
fi
exit $rc
