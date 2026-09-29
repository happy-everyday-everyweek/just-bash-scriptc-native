# just-bash → scriptc native port — carrier repo

Carrier repository for the "just-bash compiled to native via scriptc" work
(ZCode mobile fake-terminal kernel). Builds and tests run on GitHub Actions;
the dev device only edits code.

## Layout

- `packages/just-bash/` — the working tree (patched for static compilation;
  baseline at initial commit: 699 scriptc errors, tracked in build runs).
- `ci/toolchain/` — pinned toolchain inputs: `package.json` + `package-lock.json`
  (scriptc 0.1.6 + @scriptc/compiler 0.1.7) and the patched compiler dist files.
- `ci/setup-toolchain.sh` — installs the toolchain via `npm ci`, applies patches,
  guards against the nested `node_modules/scriptc/node_modules` hazard.
- `ci/build.sh` — runs the scriptc exe-lane build (`src/devprobe/entry-exe.ts`),
  writes `ci-out/build.log`, prints the SC error count, smoke-runs on success.

## Workflows

- `scriptc-build` (push + manual): installs deps, sets up toolchain, builds,
  uploads `ci-out/build.log` as artifact. Read the run log for the error list.
- `tests` (manual dispatch): runs the standard vitest suite.

## Notes

- Upstream just-bash: https://github.com/vercel-labs/just-bash
- Compiler patches applied (under `ci/toolchain/patched/`):
  - `coverage/report.js` — safeJoin fix for huge block output (was crashing the reporter).
  - `frontend/lowering/lower-exprs.js` — one-line crash-locator print (diagnostics only).
- Network note (dev device): `github.com:443` is blocked; use SSH over port 443
  (`ssh.github.com`) for `git push`.
