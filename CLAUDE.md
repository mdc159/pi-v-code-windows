# Pi vs CC — Extension Playground (Windows portability fork)

Pi Coding Agent extension examples and experiments. This checkout is the
native-Windows portability fork of `disler/pi-vs-claude-code`; see
[PORTABILITY.md](PORTABILITY.md) (audit findings, status, phase log) and
[WINDOWS_PORTING_GUIDE.md](WINDOWS_PORTING_GUIDE.md) (reusable porting lessons).

## Tooling
- **Package manager**: `bun` (not npm/yarn/pnpm)
- **Task runner**: `just` (optional; every recipe is a plain `pi -e ...` or `bun ...` command)
- **Extensions run via**: `pi -e extensions/<name>.ts`
- **Shell**: native Windows with Git Bash available; PowerShell does not support POSIX inline env assignments (`VAR=x cmd`)
- **Authentication**: reuse the installed, already-authenticated Pi — do not create a project `.env`, copy keys, or request new sign-ins
- **Env loading**: the justfile does not auto-load `.env`; bun recipes pass `--no-env-file`. Never print credential values.

## Project Structure
- `extensions/` — Pi extension source files (.ts)
- `scripts/` — Standalone scripts (coms-net hub server, extension load check)
- `specs/` — Feature specifications, including the Windows port implementation plan
- `.pi/agents/` — Agent definitions for team and chain extensions
- `.pi/agent-sessions/` — Ephemeral session files (gitignored)

## Conventions
- Extensions are standalone .ts files loaded by Pi's jiti runtime
- Available imports: `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@mariozechner/pi-ai`, `@sinclair/typebox`, plus any deps in package.json
- Register tools at the top level of the extension function (not inside event handlers)
- Use `isToolCallEventType()` for type-safe tool_call event narrowing

## Windows port discipline
- Work in phases per `specs/windows-port-implementation-plan.md`; commit, document, and pause at phase boundaries
- `bun scripts/check-extension-loads.ts` (or `just check-extensions`) is load-only — it proves imports, not lifecycle handlers, UI, subagents, or networking
- Do not make model/API calls, change authentication routes, or claim interactive workflows work without testing them
- Known-broken-on-Windows areas (CRLF parsing, subagent spawning, terminal/hub recipes, coms-net file permissions) are documented in PORTABILITY.md — do not paper over them with workarounds that weaken safety or hide failures
