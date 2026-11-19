# AGENTS.md — Zimam / ASAAS Server Control

## Project purpose

Zimam is an Arabic-first, bilingual Windows Server management appliance. It combines local server monitoring and administration with an enterprise control plane for privileged access, enrolled agents, signed jobs, session gateways, audit, licensing, and backups.

The product is Windows-native. Many administrative operations require Windows Server, an elevated process, enrolled agents, or external services such as guacd. Do not replace unavailable live data with demo values or claim an operation succeeded when its dependency is unavailable.

## Architecture and request flow

```text
Browser (Arabic RTL / English LTR)
  -> Control plane, FastAPI, 127.0.0.1:8876
       -> /api/v1/*: enterprise API and SPA
       -> /api/*: proxy to legacy local backend
  -> Legacy backend, ThreadingHTTPServer, 127.0.0.1:8765
       -> local Windows APIs, SQLite, telemetry and administration
Windows Agent (C#/.NET 10)
  -> outbound enrollment, heartbeat, signed-job polling and results
```

- `frontend/`: React 19, TypeScript, Vite, React Router, plain CSS/Tailwind, and the source-owned `asaas-ui` kit. Vite writes the production SPA to the repository-root `dist/`, not `frontend/dist/`.
- `backend/`: local legacy API built on Python's `ThreadingHTTPServer`; this is not FastAPI. `app/api/router.py` dispatches HTTP routes, `app/services/` contains business operations, `app/infrastructure/` contains SQLite/Win32/process adapters, and `app/domain/models.py` defines API models.
- `control_plane/`: FastAPI `/api/v1` application. `asaas_control/api.py` is the main route surface; focused modules own auth, permissions, vault, licensing, audit, signed jobs, gateways, SFTP, recording, replication, and mTLS. `legacy_proxy.py` forwards legacy API calls and streams.
- `agent/`: outbound-only Windows C# agent. Collectors and allowed write jobs are dispatched from `Program.cs`; jobs must be signed and allowlisted on both sides.
- `launcher/`: Windows launcher that starts the services without console windows.
- `packaging/`, `tools/`: Inno Setup installer and release/signing/certificate tooling.
- `data/`: runtime databases, keys, license, recordings and backups. Never commit live contents or secrets.
- `tests/`: legacy unit/contract tests plus live enterprise API suites.
- `control_plane/tests/`: hermetic control-plane security and license tests.
- `frontend/e2e/`: Playwright browser smoke tests.

The control plane is the identity authority for new work. New enterprise features should use `/api/v1` through `frontend/src/lib/apiV1.ts`. Legacy local-console operations remain in `frontend/src/lib/api.ts` and migrate incrementally; do not attempt a big-bang rewrite.

## Local setup

Use Windows with Python 3.12 (the CI version), Node.js 20, and npm. Run commands from the repository root unless noted.

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt -r control_plane/requirements.txt
npm --prefix frontend ci
```

Run the complete appliance:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_asaas.ps1
```

This starts available services and opens `http://127.0.0.1:8876/`. It reuses existing listeners, so restart stale development servers before verifying a new build.

Run services separately when debugging:

```bash
.venv/Scripts/python.exe backend/main.py --host 127.0.0.1 --port 8765
PYTHONPATH=control_plane .venv/Scripts/python.exe -m uvicorn asaas_control.app:app --host 127.0.0.1 --port 8876
npm --prefix frontend run dev
```

Vite serves on `:5173` and proxies `/api/v1` to `:8876` and other `/api` calls to `:8765`. The production backend serves the root `dist/` SPA.

A fresh appliance uses the setup wizard to create its first administrator. There are no supported seeded production credentials. Test-only administrators must be created explicitly in an isolated test database.

## Verification commands

Frontend:

```bash
npm --prefix frontend run build
npm --prefix frontend run lint
```

Control-plane hermetic tests:

```bash
cd control_plane
../.venv/Scripts/python.exe -m unittest discover -s tests -v
```

Legacy hermetic unit and contract tests:

```bash
.venv/Scripts/python.exe -m unittest -v \
  tests.test_api_contracts \
  tests.test_bastion_security \
  tests.test_port_isolation \
  tests.test_security_baseline \
  tests.test_telemetry_history
```

The full legacy discovery command also includes live enterprise suites:

```bash
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

Before using that full command, start an isolated backend and set `ASAAS_TEST_BASE_URL`, `ASAAS_TEST_USER`, and `ASAAS_TEST_PASS`. The enterprise tests create temporary users and exercise real Windows administration APIs; some assert Windows Server-specific capabilities. Do not run them against a production database or mistake missing credentials, a non-Server host, or missing elevation for a product regression.

Playwright requires a running isolated backend and an explicit test administrator:

```bash
cd frontend
npx playwright install chromium
E2E_BASE_URL=http://127.0.0.1:8765 \
E2E_USER=e2e-admin \
E2E_PASS='<isolated-test-password>' \
npx playwright test
```

Release builds additionally require the .NET 10 SDK and Inno Setup 6. See `tools/build-release.ps1`, `packaging/asaas.iss`, and `docs/INSTALL.md`.

## Backend and control-plane rules

- Preserve loopback-only defaults. Network exposure, TLS, and proxying are deliberate deployment decisions.
- Never log passwords, vault plaintext, session cookies, agent keys, private keys, bootstrap tokens, or authorization headers.
- Account secrets are encrypted and opened only by the intended server-side gateway operation. List APIs must not return them.
- Browser authentication uses server-side/HttpOnly sessions. Do not move credentials or bearer tokens into `localStorage`.
- Preserve RBAC checks on the server. Hiding a button in React is not authorization.
- Agent jobs require canonical Ed25519 signatures and an explicit allowlist. Adding a collector or write job requires coordinated control-plane, agent, frontend, and test changes.
- Preserve audit records for privileged mutations and the append-only audit hash chain.
- Legacy model serialization intentionally exposes both `snake_case` and `camelCase` keys where the UI contracts require them. Update contract tests when models change.
- Windows subprocesses must use the silent process wrapper/no-window flags. Avoid introducing console popups in telemetry loops.
- Keep failures honest: return a clear error or unavailable state rather than fabricated metrics, fake job success, or an empty successful response.

## Frontend rules

The frontend follows the public `frontend` and `asaas-ui` skills from `https://github.com/AI-ASAAS/skills/tree/main/frontend` (reviewed at commit `ac907bd0c5587f2d64060c648c8df75da4c5d595`). The kit is copied source owned by this project, not an npm package.

- Keep `App.tsx` focused on lazy-loaded routes. Shared chrome belongs in `components/`; route logic belongs in `pages/`; API access belongs in `lib/`.
- Reuse `asaas-ui` primitives and existing application classes before adding components. Do not add a UI library, state manager, CSS framework, or data-fetching dependency without a demonstrated need.
- Use Thmanyah Sans for controls and all numbers, Serif Display for headings, and Serif Text for descriptive prose.
- Use semantic CSS variables (`--bg`, `--text`, `--text-2`, `--accent`, `--glass-*`, `--paid`, `--partial`, `--unpaid`) rather than new hard-coded component colors. Verify light and dark themes.
- Arabic is the default and English is supported. Add every new fixed string through `t()` and add its English translation to `lib/i18n-en.ts`. Keep technical values such as IPs, ports, versions and commands in `dir="ltr"` wrappers.
- Use logical CSS properties and the existing direction variable. Do not introduce physical left/right positioning for directional layout.
- Prefer the shared breakpoints at 640px, 900px and 1080px for new work. Layout tracks must be able to shrink (`minmax(0, 1fr)`, `min-width: 0`); wide tables stay inside their scroll containers.
- Touch targets are at least 44px. Preserve keyboard focus, semantic buttons/links, dialog focus trapping, Escape handling, accessible labels, reduced-motion behavior, and safe-area padding.
- Every data view needs loading, error/retry, empty, and populated states. Never show a fake notification count, fabricated health message, placeholder identity, or indefinite loading copy as an empty state.
- Keep route-level error boundaries and lazy loading. Do not use untrusted API content with `dangerouslySetInnerHTML`.
- `styles/app.css` contains legacy overlapping layers. Prefer focused changes and remove obsolete overrides when practical; do not append broad `!important` rules that make future maintenance harder.

## Testing and delivery expectations

For each change, run the smallest relevant checks and then the standard affected suites. UI changes require a successful production build and lint plus browser verification at phone (375px), tablet (768px), and desktop widths in both themes and both languages when shared chrome changes. Check horizontal overflow, console errors, navigation, dialogs, and the main action being changed.

Do not mark work complete while affected checks are failing. Distinguish environmental limitations from verified defects in the final report. Do not commit generated `dist/`, test reports, local databases, logs, virtual environments, or release binaries unless the repository explicitly tracks them.

## Documentation map

- `README.md`: product overview and basic startup.
- `CONTROL_PLANE.md` and `control_plane/README.md`: v1 architecture and operations.
- `docs/PROJECT_MAP.md`: historical roadmap and handoff; some status entries are stale, so verify code and tests rather than treating percentages as fact.
- `docs/MIGRATION_PLAN.md`: incremental legacy-to-v1 migration strategy.
- `docs/INSTALL.md`: packaged appliance installation and deployment.
- `docs/DESIGN_SYSTEM_GUIDE.md`: project token reference; reconcile it with the current `asaas-ui` source when they differ.
- `TESTS.md`: test registry and required fixtures.
- `agent/README.md`: agent enrollment, signing, update, and service installation.

Update relevant documentation when behavior, commands, architecture, or operational requirements change.
