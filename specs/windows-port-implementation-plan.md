# Windows port: implementation plan and fresh-session handoff

## Objective

Port this repository to the current native Windows environment, reusing the existing authenticated Pi installation. Proceed in small, tested, documented commits. Extract validated lessons into a reusable guide for porting similar repositories.

The user requested planning followed by a fresh conversation before implementation continues. This file is the handoff, not a claim that the port is implemented.

## Starting state

- Fork: `mdc159/pi-v-code-windows`.
- `origin`: the fork; `upstream`: `disler/pi-vs-claude-code`.
- Implementation branch: `windows-portability`, created from `main` at `003fae0`.
- `main` already includes the approved prompt quoting fix (`95d0994`) and the audit (`003fae0`).
- `PORTABILITY.md` contains findings P01-P15, baseline results, and acceptance criteria. Read it before implementing.
- `bun install --frozen-lockfile` succeeded and installed `yaml@2.8.2` locally. Neither `bun.lock` nor `package.json` changed.
- The post-install extension-load check has NOT been run yet. The audit's earlier result was 16/18, with both failures attributable to missing `yaml`.
- Unfinished README edits were reverted at the user's request to pause. No portability code/configuration changes remain.
- No credentials were inspected, authentication changed, model requests submitted, terminal windows opened, or hub services started during setup.
- The local directory retains its original name. No worktree or additional clone is needed for sequential work.

## Working agreement

1. Keep using this implementation branch. Do not modify `main` or merge until the work is ready.
2. Complete one focused phase at a time; test and document the result before committing and moving on.
3. Preserve existing provider/authentication routes. Do not require new sign-in, a project `.env`, or copying keys. Do not silently switch subscription-backed providers to metered API routes.
4. Record what failed, why, what changed, how it was verified, what remains untested, and what generalizes to other repositories.
5. Use `PORTABILITY.md` for repository-specific progress and evidence. Create `WINDOWS_PORTING_GUIDE.md` for reusable instructions. Preserve the original audit as historical evidence rather than rewriting baseline results as current results.
6. Do not equate successful module loading with working lifecycle handlers, UI, model requests, or networking.
7. Avoid destructive verification: no indiscriminate port-owner kills, credential dumps, or unrelated profile/config changes.
8. Suggest a worktree only if parallel work, a baseline comparison, or a risky alternative would benefit from a separate checkout. Conversation branching alone does not isolate files.

## Phase 1: setup documentation and reproducible load baseline

### Scope

- Recheck Git state and installed tool versions. Reuse the successful dependency installation; install again only if necessary, with the frozen lockfile.
- Repeat the explicit load-only check for all 18 repository extensions using the active installed Pi loader. Exclude `extensions/themeMap.ts`, which is a helper rather than an extension factory.
- Consider adding a small repeatable check script that accepts the installed Pi package directory, avoiding hard-coded user paths or a second Pi dependency. Clearly document any reliance on a version-specific internal loader. Do not start sessions or provider calls merely to test imports.
- Update README title and fork attribution, native Windows prerequisites, setup commands, and known limitations. `just` is optional for direct `pi -e` usage. Retain upstream attribution and do not portray upstream demonstrations as proof of Windows support.
- Replace the mandatory API-key/`.env` instructions with reuse of existing Pi authentication. Explain optional hub/crawler/browser configuration separately.
- Disable automatic dotenv loading in `justfile`. Bun has its own automatic dotenv loading: installed Bun 1.3.14 advertises `--no-env-file`; account for this in Bun launch recipes instead of assuming changing just is sufficient. Existing process environment must still be inherited.
- Make `.env.sample` an optional, commented variable reference with no active placeholder keys. Remove unused E2B setup assumptions. Review `.gitignore` environment-file variants while retaining sanitized sample files.
- Update root agent guidance in `CLAUDE.md` to reflect Windows, existing authentication, and incremental documentation/testing. Detailed expert-prompt rewrites can remain a later phase.
- Create `WINDOWS_PORTING_GUIDE.md` with baseline discovery, shell distinctions, dependency/auth separation, verification levels, and a template for future findings.
- Update `PORTABILITY.md` with a phase log and granular status. Do not mark partially addressed findings as complete.

### Verification

- `bun install --frozen-lockfile` does not alter the tracked lockfile.
- All 18 extension factories load after dependency installation, or remaining failures are recorded accurately.
- `just --list` and safe dry runs parse correctly; do NOT execute terminal-opening or hub cleanup recipes.
- If checking dotenv behavior, use an isolated temporary directory and a harmless sentinel variable, never real credentials or the user's profile.
- Verify ordinary inherited environment variables still pass through. Check ignore rules without creating real environment/credential files.
- `git diff --check` passes; documentation links and commands agree with the implementation.
- No model/API requests, interactive workflow success claims, or authentication changes.

### Checkpoint

Commit and push this focused phase to `windows-portability`, summarize the evidence and limitations, and pause at the phase boundary. Parsing and subprocess fixes are deliberately excluded from this first commit.

## Later phases

1. **CRLF parsing (P05):** normalize or robustly parse frontmatter/team/chain data; add LF and CRLF regression cases. Do not use Git line-ending policy as the only fix.
2. **Subprocess launching (P06):** share a Windows-compatible launcher; preserve arguments, working directory, environment, streaming, cancellation, and errors. First verify with version-only/stub processes rather than model calls.
3. **Provider and child-extension policy (P07/P08):** preserve the parent provider/model, remove silent OpenRouter fallback, and explicitly retain required provider/safety extensions without recursive orchestration.
4. **Terminal and hub startup (P03/P04):** platform-aware terminal launch, correct plain-Pi handling, safe port-conflict reporting, and no killing unrelated processes.
5. **Communication permissions (P09):** Windows-aware access protection, local peer/hub tests, and explicit LAN/remote authentication. Never simply remove permission checks to make startup succeed.
6. **Safety and optional integrations (P10-P15):** Windows/PowerShell guardrails, local installed documentation for experts, browser setup/naming, prompt loading/precedence, unused dotenv cleanup, and remaining documentation drift.
7. **End-to-end parity:** test UI, reload/shutdown, team/chain/subagent workflows, same-machine messaging, and optional integrations. Distinguish local deterministic tests from model-backed tests; plan any actual provider usage explicitly. Add repeatable regression coverage and finish the reusable guide.

Each phase may be split into smaller commits when implementation reveals a useful independent boundary. Do not expand a phase into an unrelated rewrite merely because another issue is nearby.

## Fresh-session starting prompt

> Continue the Windows port on branch `windows-portability`. Read `specs/windows-port-implementation-plan.md`, `PORTABILITY.md`, and the repository instructions. Verify the current Git state, then implement Phase 1 only. Preserve existing Pi authentication, make no model/API calls, and document tested results separately from unverified behavior. Commit the tested phase and stop for review before parsing or subprocess work.
