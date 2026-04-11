---
name: rune-sentinel-env
description: "Environment-aware pre-flight check. Validates OS, runtime versions, installed tools, port availability, env vars, and disk space BEFORE coding starts. Prevents \"works on my machine\" failures. Like sentinel but for the environment, not the code."
---


# sentinel-env

> **RUNE COMPLIANCE**: Before ANY code response, you MUST:
> 1. Classify this request (CODE_CHANGE | QUESTION | DEBUG | REVIEW | EXPLORE)
> 2. Route through the correct Rune skill (see skill-router routing table)
> 3. Follow the skill's workflow — do NOT freelance or skip steps
> Violation: writing code without skill routing = incorrect behavior.

## Platform Constraints

- SHOULD: Monitor your context usage. If working on a long task, summarize progress before context fills up.
- MUST: Before summarizing/compacting context, save important decisions and progress to project files.
- SHOULD: Before ending, save architectural decisions and progress to .rune/ directory for future sessions.

## Purpose

Catch environment mismatches before they waste debugging time. Validates that the developer's machine has the right runtime versions, tools, ports, and configuration to run the project. Prevents the entire class of "works on my machine" failures that masquerade as code bugs.

This is the environment counterpart to `sentinel` (which checks code security) and `preflight` (which checks code quality). sentinel-env checks the MACHINE, not the code.

## Triggers

- Called by `cook` Phase 0.5 — before planning, after resume check (first run in a new project only)
- Called by `scaffold` — after project bootstrap, verify environment matches generated config
- Called by `onboard` — during project onboarding, verify developer can run the project
- `/rune env-check` — manual environment validation
- Auto-trigger: when `npm install`, `pip install`, or similar fails during cook

## Calls (outbound)

None — sentinel-env is a pure read-only utility. It checks and reports, never modifies.

## Called By (inbound)

- `cook` (L1): Phase 0.5 — first run detection (no `.rune/` directory exists)
- `scaffold` (L1): post-bootstrap environment validation
- `onboard` (L2): developer onboarding verification
- User: `/rune env-check` direct invocation

## Execution

### Step 1: Detect Project Type

Read project configuration files to determine what environment is needed:

1. Find files by pattern to check for project config files:
   - `package.json` → Node.js project
   - `pyproject.toml` / `setup.py` / `requirements.txt` → Python project
   - `Cargo.toml` → Rust project
   - `go.mod` → Go project
   - `Gemfile` → Ruby project
   - `docker-compose.yml` / `Dockerfile` → Docker project
   - `.nvmrc` / `.node-version` → specific Node version required
   - `.python-version` → specific Python version required

2. Read each detected config file to extract version constraints:
   - `package.json` → `engines.node`, `engines.npm`, dependency versions
   - `pyproject.toml` → `requires-python`, dependency versions
   - `Cargo.toml` → `rust-version`
   - `go.mod` → `go` directive version

3. Build an environment requirements checklist from the detected configs.

### Step 2: Runtime Version Check

For each detected runtime, verify the installed version matches constraints:

```bash
# Node.js
node --version    # Compare against package.json engines.node or .nvmrc
npm --version     # Compare against package.json engines.npm
# or pnpm/yarn/bun depending on lockfile present

# Python
python --version  # Compare against pyproject.toml requires-python
pip --version

# Rust
rustc --version   # Compare against Cargo.toml rust-version
cargo --version

# Go
go version        # Compare against go.mod go directive

# Docker
docker --version
docker compose version
```

**Version comparison logic:**
- If the constraint is `>=18.0.0` and installed is `20.11.1` → PASS
- If the constraint is `>=18.0.0` and installed is `16.20.2` → BLOCK (wrong major version)
- If the runtime is not installed at all → BLOCK
- If no version constraint exists in config → WARN (version unconstrained)

### Step 3: Required Tools Check

Detect and verify tools the project depends on:

1. **Package manager**: Check which lockfile exists and verify the matching tool is installed
   - `package-lock.json` → npm
   - `pnpm-lock.yaml` → pnpm
   - `yarn.lock` → yarn
   - `bun.lockb` → bun
   - `poetry.lock` → poetry
   - `uv.lock` → uv
   - Mismatched lockfile + installed tool → WARN (e.g., yarn.lock exists but only npm installed)

2. **Git**: `git --version` — required for all projects
3. **Docker**: Check only if `Dockerfile` or `docker-compose.yml` exists
4. **Database tools**: Check if `prisma`, `drizzle`, `alembic`, `django` migrations exist → verify DB client installed
5. **Build tools**: Check for `turbo.json` (turborepo), `nx.json` (Nx), `Makefile`, etc.

6. **Hard dependencies** — tools the project WRAPS (not just uses as dev dependency):
   Scan for evidence that the project wraps an external tool:
   - search file contents for `shutil.which(`, `which `, `command -v ` → project looks up an executable at runtime
   - search file contents for `subprocess.run(`, `child_process.exec(`, `Deno.Command(` → project invokes external CLI
   - read the file README/docs for "requires X installed" or "depends on X"

   For each detected hard dependency:
   ```bash
   # Verify the tool exists on PATH
   which <tool-name> 2>/dev/null || echo "MISSING: <tool-name>"
   # If found, check version
   <tool-name> --version 2>/dev/null
   ```

   **Verdict:**
   - Tool found on PATH → PASS (log version)
   - Tool NOT found → **BLOCK** with clear install instructions per OS:
     ```
     [ENV-XXX] Required tool '<tool>' not found on PATH
       → Debian/Ubuntu: sudo apt install <tool>
       → macOS: brew install <tool>
       → Windows: winget install <tool> (or choco install <tool>)
       → Manual: <download URL if known>
     ```
   - This prevents the entire class of "it worked in CI but not locally" failures where `subprocess.run()` silently fails

### Step 4: Port Availability Check

Detect which ports the project needs and check if they're available:

1. Parse port information from:
   - `package.json` scripts (look for `--port`, `-p`, `PORT=` patterns)
   - `.env` / `.env.example` (look for `PORT=`, `DATABASE_URL` with port)
   - `docker-compose.yml` (ports section)
   - Common defaults: 3000 (Next.js/React), 5173 (Vite), 8000 (Django/FastAPI), 5432 (PostgreSQL), 6379 (Redis)

2. Check each port:
   ```bash
   # Cross-platform port check
   # Windows: netstat -ano | findstr :PORT
   # Unix: lsof -i :PORT or ss -tlnp | grep :PORT
   ```

3. If port is in use → WARN with the process name using it

### Step 5: Environment Variables Check

Compare required env vars against actual configuration:

1. Read `.env.example` or `.env.template` if it exists
2. Read `.env` if it exists (DO NOT log values — only check key presence)
3. For each key in `.env.example`:
   - Present in `.env` → PASS
   - Missing from `.env` → WARN (with the key name, never the expected value)
4. Check for dangerous patterns:
   - `.env` committed to git (check `.gitignore`) → BLOCK (security risk)
   - Placeholder values still present (`your-api-key-here`, `changeme`, `xxx`) → WARN

### Step 6: Disk Space and System Resources

Quick system health check:

1. **Disk space**: Check available space on the project drive
   - < 1 GB → WARN
   - < 500 MB → BLOCK (npm install / docker build will fail)

2. **Platform-specific checks**:
   - **Windows**: Check for long path support (`git config core.longpaths` for node_modules)
   - **macOS**: Check Xcode CLI tools if native modules detected (`node-gyp` in dependencies)
   - **Linux**: Check file watcher limit if large project (`fs.inotify.max_user_watches`)

### Step 7: Report

Produce a structured environment report:

**Verdict logic:**
- Any BLOCK finding → **BLOCKED** (environment cannot run this project)
- Any WARN finding → **READY WITH WARNINGS** (can run but may hit issues)
- All checks pass → **READY** (environment is correctly configured)

For each finding, include a specific remediation command the developer can copy-paste.

## Output Format

```
## Environment Check: [project name]
- **Project type**: [Node.js / Python / Rust / Go / Multi]
- **Checks run**: [count]
- **Verdict**: READY | READY WITH WARNINGS | BLOCKED

### BLOCKED
- [ENV-001] Node.js 16.20.2 installed but >=18.0.0 required
  → Fix: `nvm install 18 && nvm use 18`

### WARNINGS
- [ENV-002] Port 3000 in use by process "node" (PID 12345)
  → Fix: `kill 12345` or change PORT in .env
- [ENV-003] Missing env var: DATABASE_URL (required by .env.example)
  → Fix: Copy from .env.example and fill in your database connection string

### PASSED
- [ENV-004] pnpm 9.1.0 ✓ (matches pnpm-lock.yaml)
- [ENV-005] Git 2.44.0 ✓
- [ENV-006] Docker 25.0.3 ✓
- [ENV-007] Disk space: 42 GB available ✓
```

## Constraints

1. MUST be read-only — never install, update, or modify anything on the developer's machine
2. MUST NOT log environment variable VALUES — only check key presence (security)
3. MUST provide copy-paste remediation commands for every BLOCK and WARN finding
4. MUST handle cross-platform differences (Windows/macOS/Linux) gracefully
5. MUST complete in under 10 seconds — use parallel Bash calls where possible
6. MUST NOT block on WARN findings — only BLOCK findings prevent proceeding

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| False BLOCK on version — semver parsing error | HIGH | Use simple major.minor comparison, not full semver regex |
| Slowness on Windows — netstat/port checks are slower | MEDIUM | Timeout port checks at 3s, skip if slow |
| .env file contains secrets — accidentally logged | CRITICAL | NEVER read .env values, only check key existence via grep for key names |
| Platform detection wrong — WSL vs native Windows | MEDIUM | Check for WSL explicitly (`uname -r` contains "microsoft") |
| Over-checking — flagging optional tools as required | MEDIUM | Only check tools evidenced by config files, not speculative |
| Missing hard dependency — project wraps external CLI but tool not checked | HIGH | Step 3.6: scan for `shutil.which`, `subprocess.run`, `child_process.exec` → verify tool exists on PATH |
| Hard dep found but wrong version — tool exists but API changed | MEDIUM | Log version for manual review. Version compatibility is project-specific — don't guess |

## Done When

- All detected project runtimes version-checked against constraints
- Package manager matches lockfile type
- Required ports checked for availability
- Environment variables compared against .env.example (keys only)
- Disk space verified adequate
- Structured report with READY / READY WITH WARNINGS / BLOCKED verdict
- Every BLOCK/WARN finding has a copy-paste remediation command

## Cost Profile

~500-1000 tokens input, ~500-1000 tokens output. Haiku model — this is fast, cheap, read-only scanning. Runs once per new project (or on manual invoke). Sub-10-second execution target.

---
> **Rune Skill Mesh** — 62 skills, 215+ connections, 14 extension packs
> [Landing Page](https://rune-kit.github.io/rune) · [Source](https://github.com/rune-kit/rune) (MIT)
> **Rune Pro** ($49 lifetime) — product, sales, data-science, support packs → [rune-kit/rune-pro](https://github.com/rune-kit/rune-pro)
> **Rune Business** ($149 lifetime) — finance, legal, HR, enterprise-search packs → [rune-kit/rune-business](https://github.com/rune-kit/rune-business)