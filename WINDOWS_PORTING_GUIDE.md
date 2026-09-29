# Windows Porting Guide

Reusable lessons for porting a macOS/Unix-first agentic-coding repository to
native Windows. Extracted from porting `disler/pi-vs-claude-code` to
`mdc159/pi-v-code-windows`; repository-specific evidence lives in
[PORTABILITY.md](PORTABILITY.md), and the phased plan in
[specs/windows-port-implementation-plan.md](specs/windows-port-implementation-plan.md).

Core principle: **inventory before you change, verify every claim, and never
fix a broken check by weakening it.**

## 1. Baseline discovery

Before changing anything, record what exists and what actually runs.

1. **Fork and branch strategy.** Fork upstream, add it as `upstream`, keep
   `origin` as the fork, and do all work on a dedicated branch. Never port on
   top of `main` — you need a clean line to compare against.
2. **Toolchain inventory.** Record exact versions of the agent CLI, Node,
   Bun, task runner, and shells (`pi --version`, `node --version`,
   `bun --version`, `just --version`). Note which optional CLIs are missing
   from PATH (e.g. `firecrawl`, `playwright-cli`, `lsof`) — missing tools and
   broken code produce different symptoms and must not be conflated.
3. **Check what is already true.** An installed, authenticated agent CLI is
   reusable as-is: no second install, no new keys, no project `.env`. Verify
   with version-only, no-network commands rather than assuming.
4. **Install declared dependencies with the project's own package manager**
   (`bun install --frozen-lockfile`) and confirm the lockfile does not drift.
5. **Run the cheapest meaningful check before any porting work** (see
   verification levels below) so you can tell pre-existing breakage from
   breakage you introduced.

## 2. Shell distinctions

- **Git Bash, PowerShell, and cmd are different environments.** A command
  that works in Git Bash (`pi --version` via shims) may not be spawnable by
  Node's `child_process` without a shell — command shims (`.cmd` files) are
  not native executables. This is the classic Windows `ENOENT` trap.
- **POSIX inline environment assignments** (`VAR=value command`) do not work
  in PowerShell or cmd. Write launch configuration as explicit cross-platform
  steps, or document the shell requirement per command.
- **`just` recipes run under `sh`** (Git Bash provides it on Windows). Recipes
  can stay POSIX, but anything they invoke must exist as a real program.
- **Line endings: Git checkout policy decides what your parsers see.** A
  Windows clone typically produces CRLF working-tree files. Parsers written
  against `\n`-delimited data (frontmatter regexes, YAML heading scanners)
  silently match nothing. Fix the parsers, not just the Git config — a
  `.gitattributes` policy alone does not help existing checkouts or
  user-supplied files.
- **Filesystem permission semantics differ.** POSIX mode bits (`chmod 0600`)
  are approximations on Windows; `stat.mode` does not reflect ACLs. Do not
  treat a strict mode check as an access-control guarantee — and do not
  "fix" it by trusting every readable file.
- **Unix tools are not present** (`lsof`, `osascript`, AppleScript). Recipes
  that depend on them fail on Windows; port-owner killing via `lsof | xargs
  kill` is also unsafe on any platform.

## 3. Dependency vs. authentication separation

Keep two unrelated concerns separate in both code and docs:

- **Repository dependencies** (`package.json`, installed with the project's
  package manager) are required for code to import. Missing deps look like
  load failures — fix with `bun install`, not with auth changes.
- **Provider authentication** belongs to the installed agent CLI (saved
  credentials, OAuth). A project-local `.env` is at most an optional
  alternative, never a prerequisite.

Implicit environment loading is a portability hazard in itself:

| Mechanism | Behavior | Hazard |
| --- | --- | --- |
| `set dotenv-load := true` in just | Loads `.env` for every recipe | Implicit, surprising config source |
| Bun (≥1.1, incl. 1.3.x) | Auto-loads `.env` from cwd unless `--no-env-file` | Runs different code under bun vs. node |
| `python-dotenv` `load_dotenv()` | Loads `.env` into the process | Unused in display-only scripts; delete |
| Node | No auto `.env` loading | — |

Preferred state: no implicit dotenv anywhere; recipes inherit the calling
shell's environment; `.env.sample` is a commented variable reference, not a
fill-in template. When you remove `set dotenv-load` from a justfile, remember
Bun recipes still need `--no-env-file` — changing just alone is not enough.
Verify with an isolated temp directory and a sentinel variable (never real
credentials): auto-loading disabled, inherited variables still pass through.

## 4. Verification levels

Label every test claim with its level; never let a lower level imply a higher one.

| Level | What it proves | Example | Does NOT prove |
| --- | --- | --- | --- |
| L0 — Load/import | The module imports and the factory runs against a stub API; registrations succeed | `bun scripts/check-extension-loads.ts` | Lifecycle handlers, UI, subprocesses, network |
| L1 — Lifecycle | Event handlers fire on real session events | Start a session, trigger compaction/reload | Correct end-to-end behavior |
| L2 — Interactive UI | Widgets, overlays, keybindings render and respond | Manual or scripted terminal session | Headless/automation paths |
| L3 — Subprocess | Child processes spawn with correct argv, cwd, env, streaming, cancellation | Spawn a version-print stub, never a model call | Anything about the model provider |
| L4 — Local network | Peers/hubs discover, authenticate, and exchange messages on one machine | Two local agents over named pipes/localhost | Cross-machine behavior, LAN safety |
| L5 — Model-backed E2E | The full workflow works with real provider calls | Explicitly planned, opt-in, budgeted | Nothing below it is thereby re-verified |

Rules of thumb:

- Never use a model/API request as an import test; never treat a successful
  import as a working feature.
- Prefer stub processes (`--version`, echo servers) for subprocess and
  network levels.
- Record untested behavior as untested, not as "should work".

## 5. The load-only check

`scripts/check-extension-loads.ts` imports each `extensions/*.ts` factory
through the installed Pi package's internal loader
(`dist/core/extensions/loader.js`, `loadExtensions()`), which:

- compiles TypeScript via jiti with compatibility aliases for the legacy
  `@mariozechner/*` and `@sinclair/typebox` import names,
- runs each factory against a stub runtime where registration calls succeed
  and action methods throw (mirroring real pre-bind startup),
- returns per-path errors without starting a session or touching providers.

Caveats to keep documented: the loader path is **version-specific internals**
(verified against Pi 0.87.1) and is not part of the package's public export
surface; the script accepts an explicit Pi package directory (defaulting to
the global npm install) precisely so it does not depend on hard-coded user
paths or a second Pi dependency.

## 6. Findings template

Record each portability issue the same way:

```markdown
### Pnn. Short title

**Files:** the exact files and lines
**Symptom:** observable behavior on Windows (with the command that shows it)
**Root cause:** why it fails (platform assumption, missing dep, parser, ...)
**Proposed work:** the fix direction, and what it must NOT weaken
**Verification:** level (L0–L5) and concrete command/evidence for the fix
**Generalizes:** which part applies to similar repositories
```

Phase log entries should state: what changed, what was verified (with the
actual result), what remains untested, and what generalizes.

## 7. Working agreement (summary)

1. One focused phase at a time; test, document, commit, pause for review.
2. Preserve existing provider/auth routes; no silent billing-route changes.
3. No destructive verification (port-owner kills, credential dumps).
4. Loading ≠ working; untested ≠ working.
5. Keep upstream attribution; never present upstream demos as proof of
   Windows support.
