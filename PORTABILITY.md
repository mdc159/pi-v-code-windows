# Pi V Code Windows: Portability Audit

This document records the Windows and provider-authentication audit before portability changes are implemented.

- **Fork:** https://github.com/mdc159/pi-v-code-windows
- **Upstream:** https://github.com/disler/pi-vs-claude-code
- **Audited baseline:** `0ed11f4` (`add thinking and model to subagents`)
- **Target:** native Windows with an already configured and authenticated Pi installation; Git Bash is available. WSL is not assumed.
- **Status:** findings and proposed work only. The earlier `argument-hint` quoting fix is separate from the pending portability work.

## Guiding requirements

1. Reuse Pi's existing provider configuration and authentication. Do not require a project `.env`, copy credentials into the repository, or repeat sign-in unnecessarily.
2. Preserve the selected provider and authentication route. A subscription-backed provider must not silently become a metered API provider.
3. Support native Windows, including process launching, CRLF files, path handling, and filesystem permissions. Retain other platforms where practical.
4. Treat optional integrations separately from ordinary Pi usage.
5. Do not weaken security checks merely to make Windows startup succeed.
6. Make no portability implementation changes until this inventory has been reviewed.

## Verification scope and environment

The audit examined the README, recipes, project configuration, extension launch paths, agent definitions, optional integrations, and related documentation. It also checked the installed Pi documentation and loader behavior.

Observed toolchain:

| Tool | Version / availability |
| --- | --- |
| Pi | 0.87.1 |
| Node.js | 24.13.0 |
| Bun | 1.3.14 |
| just | 1.57.0 |
| Git Bash | Available |
| Windows PowerShell | Available |
| Windows Terminal launcher | Available on PATH; opening a window was not tested |
| `firecrawl`, `playwright-cli`, `lsof`, `osascript` | Not found on the audit shell's PATH |

No project `.env` or local `node_modules/yaml` installation existed during the audit. No credential values were inspected or printed. No model/API requests, interactive agent workflows, or end-to-end network communication tests were performed. No portability code was changed.

### Local check results

- **Extension loading:** 16 of 18 extensions loaded through installed Pi's extension loader. The two damage-control variants failed because `yaml` was not installed locally. Loading is not proof that every lifecycle handler or interactive workflow works.
- **Subprocess launching:** Node's `spawn("pi", ["--version"])` failed with `ENOENT`. Launching the installed Pi CLI entry point through Node succeeded and returned `0.87.1`.
- **Line endings:** the strict frontmatter regex matched 0 of 8 top-level agent Markdown files and 0 of 10 files in `.pi/agents/pi-pi/`. Normalizing CRLF to LF in memory made all 18 match. The latter group includes the orchestrator definition, which the expert loader intentionally excludes.
- **Team/chain headings:** existing parsers recognized zero top-level definitions in each YAML file. In-memory CRLF normalization exposed five team definitions and five chain definitions.
- **Windows permissions:** a non-secret temporary file created with mode `0600`, then passed through `chmod(0600)`, reported mode `0666`. It would fail the coms-net client's strict mode check. The scratch file was removed.
- **Recipes:** `just --list` succeeded; dry runs confirmed the macOS and Unix command assumptions. Terminal-opening and process-killing recipes were not executed.
- **Legacy imports:** installed Pi supplies compatibility aliases for the repository's `@mariozechner/*` and `@sinclair/typebox` imports. Those names were not an immediate loading blocker.

## Findings

### P01. API keys and `.env` are incorrectly presented as mandatory

**Files:** `README.md` (API Keys and Sourcing sections), `.env.sample`, `justfile:1`

Pi can use saved provider credentials, including OAuth. Environment API keys are one supported authentication method, not a universal prerequisite. An already authenticated installation should launch normally without a project `.env`.

`justfile` currently enables `set dotenv-load := true` for all recipes. This makes project-local environment configuration implicit, even when a recipe does not need it. The README also recommends Bash/zsh sourcing and a shell alias, rather than distinguishing native Windows shells and existing Pi configuration.

**Proposed work:** lead with reuse of existing Pi authentication; remove implicit dotenv loading from the default workflow; document explicitly opted-in environment configuration only where needed. Do not change working native authentication or export credentials to plaintext files.

### P02. Setup documentation is macOS-oriented and conflates dependencies with authentication

**Files:** `README.md` (Prerequisites and Installation), `package.json`

The README recommends `brew install just` and says all three tools are required. `just` is a convenience for recipes; extensions can also be launched directly with Pi. Bun installs the repository dependency and runs the network hub, while Pi extensions execute inside Pi.

The existing Windows installation already has the core tools. It does not need a second Pi installation or new provider keys. It still needs `bun install` for the declared local `yaml` dependency. Both damage-control extensions currently fail at import time without that dependency.

**Proposed work:** document native Windows prerequisites, distinguish required versus optional tools, and keep dependency installation separate from provider authentication.

### P03. Opening terminals is macOS-only, and the launch-all recipe has an invalid target

**Files:** `justfile:93-119`

`just open` uses AppleScript through `osascript` and Terminal.app. These are unavailable on native Windows.

`just all` starts with `just open pi`, which constructs `-e extensions/pi.ts`; that file does not exist. Plain Pi needs a distinct launch path. The recipe also does not actually enumerate every extension advertised in the README.

**Proposed work:** introduce a platform-aware terminal launcher with safe argument handling, a plain-Pi case, and accurate launch-all coverage/documentation. Test paths containing spaces.

### P04. Hub startup uses Unix tools and indiscriminate port-owner termination

**Files:** `justfile:131-139`, `scripts/coms-net-server.ts:31-32`

The server recipes run `lsof | xargs ... kill` before startup. `lsof` is absent here, and killing the owner of a port does not establish that the process belongs to this application.

The cleanup command assumes port `52965` when no port is configured, whereas the server defaults to port `0` and lets the OS choose. The LAN recipe also uses POSIX inline environment-assignment syntax, which is not native PowerShell syntax.

**Proposed work:** use portable launch configuration and fail clearly on occupied ports. If stale-process cleanup is retained, verify application ownership before termination. Keep documented port behavior consistent with the server.

### P05. CRLF line endings prevent agent, team, and chain discovery

**Files:** `extensions/agent-team.ts`, `extensions/agent-chain.ts`, `extensions/pi-pi.ts`, `extensions/coms.ts`, `extensions/coms-net.ts`, `.pi/agents/`

Several frontmatter parsers require literal LF delimiters such as `^---\n`. Team and chain parsers split on `\n` but do not account for the remaining `\r` when matching top-level headings. The Windows checkout uses CRLF, causing the confirmed discovery failures listed above.

The communication extensions use the same strict frontmatter pattern for identities supplied through prompt files. Their metadata parsing is exposed to the same issue.

**Proposed work:** normalize line endings or use robust shared parsers. Add LF and CRLF regression cases. Consider `.gitattributes` for predictable repository text without relying on it as the only parser fix.

### P06. Four subagent launchers fail on native Windows

**Files:** `extensions/subagent-widget.ts:229`, `extensions/agent-team.ts:368`, `extensions/agent-chain.ts:367`, `extensions/pi-pi.ts:294`

All four use `spawn("pi", ...)` without a shell. A Pi command that resolves successfully in Git Bash is not necessarily a native executable that Node can spawn directly. The installed command-shim arrangement reproduces `ENOENT` here.

**Proposed work:** share a Windows-compatible launcher using the active runtime and a correctly resolved Pi CLI entry point, or another supported cross-platform mechanism. Avoid building shell command strings from prompts. Preserve argument boundaries, working directory, environment, streaming output, cancellation, and error reporting.

### P07. Model defaults can select a different authentication or billing route

**Files:** the four subagent extensions; `justfile:147-161`

The subagents normally inherit the parent's fully qualified provider/model, which should be preserved. However, all four hard-code an OpenRouter fallback when no parent model is available.

`just coms1` explicitly selects `--provider openai`. The audited session uses the separate `openai-codex` provider. Authentication for one route must not be assumed to authorize the other. The other model-specific recipes also assume availability of particular models/providers.

**Proposed work:** inherit existing selection by default; require explicit provider/model overrides; fail clearly rather than silently changing providers. Keep model-specific recipes as clearly labeled, opt-in examples or replace them with configurable recipes.

### P08. Subagents disable configured extensions

**Files:** the four subagent extensions (`--no-extensions` in child arguments)

This flag disables configured/discovered extensions. It does not remove saved credentials for built-in providers, but providers implemented by extensions may disappear. Parent safety hooks and other required extension behavior also do not automatically carry over.

**Proposed work:** define a child-extension policy that avoids recursive orchestration while preserving explicitly required provider and safety extensions. Do not blindly enable every parent extension or assume disabling all extensions is harmless.

### P09. Local coms-net authentication assumes POSIX file permissions

**Files:** `extensions/coms-net.ts:306-320`, `scripts/coms-net-server.ts:1487-1499`

For localhost, the hub auto-generates a token and writes a discovery file. The client accepts that file only when `stat.mode & 0o777` equals `0600`. Native Windows permission semantics do not satisfy that assumption in the reproduced test.

Consequently, automatic token discovery can fail even though the hub wrote its file successfully. The server's `chmod 0600` banner is also not proof of equivalent Windows access protection.

**Proposed work:** use Windows-aware owner/access protection and validation while retaining appropriate POSIX checks elsewhere. Do not fix this by simply trusting any readable token file. Verify local named-pipe access protections as well; `coms.ts` already has a Windows named-pipe transport branch, but transport support is not a complete permissions audit.

### P10. Optional integrations need separate, accurate setup guidance

**Files:** `.env.sample`, `scripts/coms-net-server.ts`, `.pi/skills/bowser/SKILL.md`, `.pi/agents/bowser.md`

- **Network hub:** its token is separate from model-provider authentication. LAN/remote hosting requires an explicitly configured shared token. Localhost already attempts automatic generation, subject to P09. A `.env` file is not the only way to supply configuration.
- **Firecrawl:** optional for documentation retrieval because agent prompts include a curl fallback. Its key is not required for ordinary Pi use; its CLI is not currently on PATH.
- **E2B:** `E2B_API_KEY` appears in the sample, but no implementation consuming it was found elsewhere in this repository. It should not look like a prerequisite.
- **Browser automation:** `playwright-cli` is not currently on PATH. The agent refers to `playwright-bowser`, while the bundled skill identifies itself as `bowser`; the skill also references a local documentation file not included in this checkout. Browser setup and naming need reconciliation before advertising a working workflow.

**Proposed work:** document only actual integrations, identify optional executables and authentication independently, and prefer secure runtime injection for credentials when needed. Do not ask users to paste secrets into prompts.

### P11. Expert agents prioritize remote documentation and Unix temporary paths

**Files:** `.pi/agents/pi-pi/*.md`, `README.md` (Web Crawling Fallbacks), `specs/pi-pi.md`

The experts mandate fetching upstream documentation using Firecrawl/curl and saving to `/tmp`. The installed Pi documentation is available locally and matches the active version. Upstream `main` can differ from installed Pi. Git Bash and native Node tools can also interpret Unix-looking temporary paths differently.

The configuration expert instructs agents to include environment-variable provider setup, reinforcing the incorrect assumption that new keys are needed.

**Proposed work:** prefer installed documentation and examples; fetch remote material only when needed; use portable temporary paths; make existing authentication the default in agent guidance too.

### P12. Damage-control is not comprehensive Windows protection

**Files:** `extensions/damage-control.ts`, `extensions/damage-control-continue.ts`, `.pi/damage-control-rules.yaml`

Command checks focus on the `bash` tool and Unix command patterns. They do not directly cover Pi's optional `powershell` tool. Path checks use case-sensitive comparisons and mixed separator assumptions, while system-path rules emphasize Unix directories.

The continue variant also suggests asking the user directly for a protected value when needed. That is inappropriate as the default recovery path for machine-managed credentials.

**Proposed work:** test Windows casing, separators, directory boundaries, and PowerShell command coverage; review protected paths for the actual environment; replace credential-copy requests with supported secure access guidance. Clearly describe these heuristics as guardrails, not a security boundary or sandbox.

### P13. README command examples drift from implementation

**Files:** `README.md`, `extensions/coms.ts`, `extensions/coms-net.ts`, `extensions/agent-team.ts`

- Communication examples use `--name` alone, but the extensions register `--cname` for peer identity. Pi owns `--name` for session naming. Use both when both names should match.
- The README labels the team selector `/team`; the extension registers `/agents-team`.
- Calling a recipe "plain Pi, no extensions" is misleading when normal Pi startup still loads configured global extensions.
- The local transport supports Windows named pipes, not only Unix sockets.

**Proposed work:** reconcile examples and descriptions with actual CLI flags, commands, discovery behavior, and supported transports.

### P14. Prompt loading and the earlier warning need accurate documentation

**Files:** `.pi/settings.json`, `.claude/commands/plan_w_team.md`, `extensions/cross-agent.ts`

Project settings explicitly load `../.claude/commands` as Pi prompt templates. Therefore Pi can report YAML problems in these files; the earlier claim that the warning necessarily came from Claude Code was incorrect.

The existing fix quotes the string:

```yaml
argument-hint: "[user prompt] [orchestration prompt]"
```

`cross-agent` also registers commands from `.claude/commands`. Its interaction with native prompt-template loading should be documented and tested, rather than treating the two loading paths as unrelated. Loading a Claude-oriented prompt does not itself provide Claude Code's team-management tools in Pi.

**Proposed work:** preserve the quoting fix; explain the configured prompt source; verify command precedence and argument handling when both mechanisms are enabled.

### P15. Supporting configuration and test coverage need cleanup

**Files:** `.claude/status_lines/status_line.py`, `.gitignore`, `package.json`, `CLAUDE.md`, companion documentation

- The Claude status-line script imports `python-dotenv` and calls `load_dotenv()`, but its display logic does not use environment settings. This is another unnecessary dotenv assumption, separate from Pi startup.
- `.gitignore` excludes `.env` but not all environment-file variants. Any retained optional configuration examples should have an explicit secret-safe ignore policy that still permits sanitized samples.
- No checked-in test suite, test script, TypeScript configuration, or CI workflow was found for validating this portability work.
- Installed Pi currently supports the old import names through aliases; migration is a maintenance decision, not an immediate requirement to restore loading.

**Proposed work:** remove unused setup requirements, review ignore patterns, update agent-facing conventions, and add focused automated portability tests before broad refactoring.

## Suggested implementation order

All items below are pending; this document is not an implementation claim.

- [ ] Update README, optional configuration samples, and agent instructions for existing Pi authentication and native Windows.
- [ ] Install declared dependencies with Bun and repeat extension-load checks.
- [ ] Fix CRLF parsing and add shared parser regression tests.
- [ ] Add a cross-platform subagent launcher and verify argument preservation, streaming, errors, and cancellation.
- [ ] Preserve provider/model selection and define the child-extension policy.
- [ ] Replace macOS-only terminal launch behavior and unsafe hub cleanup; fix the plain-Pi launch-all case.
- [ ] Correct Windows communication permissions and test local peer/hub workflows.
- [ ] Review Windows/PowerShell safety rules without weakening existing protections.
- [ ] Reconcile optional browser/crawler integrations, command examples, and prompt loading.
- [ ] Add repeatable Windows tests and retain cross-platform coverage where supported.

## Acceptance criteria for the later implementation

- Basic Pi and ordinary extension launches work without a project `.env` or new sign-in.
- Existing provider/authentication selection is preserved; unavailable models/providers produce actionable errors rather than silent fallback billing routes.
- All 18 extensions load after dependency installation, and applicable session behavior is tested separately.
- Agent, expert, team, and chain discovery works with both LF and CRLF inputs.
- Subagents launch on native Windows with correct arguments and working directory.
- Terminal recipes do not require AppleScript on Windows, and hub startup never kills unrelated processes.
- Local communication works with platform-appropriate access protection; LAN/remote authentication remains explicit.
- Tests do not print secrets, make unrequested model calls, or alter working authentication.
