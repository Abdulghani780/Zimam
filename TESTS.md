# TESTS.md — Test Assets and Required Test Points

> This registry governs the test assets, verification gates, and regression protection for **ASAAS v2**.
> Test code remains the executable truth; this document stores indexes, assessments, and verifiable evidence.

---

## 1. Test Entry Points

| Execution group | Command | When to run | External dependencies |
|---|---|---|---|
| **Backend Unit & Contract Suite** | `python -m unittest discover -s tests -v` | Pre-commit / PR / CI | Python 3.10+, psutil |
| **Frontend Type & Build Verification** | `npm --prefix frontend run build` | UI changes / Pre-commit | Node 18+, Vite 6, TypeScript 5.7 |
| **Full Cross-Boundary End-to-End** | `python tests/test_api_contracts.py` | API contract changes | None (in-process mocks & models) |
| **Security Risk Evaluator Test** | `python -m unittest tests/test_bastion_security.py` | Security / Bastion ACL updates | None |
| **Port Isolation Guard Test** | `python -m unittest tests/test_port_isolation.py` | Networking & Port service changes | None |
| **Control Plane v1 Suite** | `cd control_plane && python -m unittest` | Auth/agents/jobs/audit/vault/license changes | Python 3.10+ |
| **Playwright E2E & Visual Matrix** | `cd frontend && npx playwright test` | UI/navigation/viewport changes | Live backend on :8765, `npx playwright install` |

---

## 2. Test Asset Map

Controlled levels: `unit`, `integration`, `contract`, `E2E`, `smoke`.  
Controlled purposes: `rule protection`, `critical path`, `regression protection`, `specialized protection`.

| Module or workflow | Level | Purpose | Execution group | External dependencies | Test location | Assessment |
|---|---|---|---|---|---|---|
| **AI Port Isolation & Conflict Guard** | unit, integration | rule protection, critical path | Backend Suite | None | `tests/test_port_isolation.py` | required |
| **4-Panel System Monitor (Oscilloscope)** | integration | rule protection, critical path | Backend Suite | psutil | `tests/test_telemetry_history.py` | required |
| **Bastion Command Risk ACL Interceptor** | unit | security protection, rule protection | Security Suite | None | `tests/test_bastion_security.py` | required |
| **Dual-Key API Data Models (Contract)** | contract | regression protection, rule protection | Contract Suite | None | `tests/test_api_contracts.py` | required |
| **Frontend SPA Build & Type Safety** | contract, smoke | rule protection, smoke | Frontend Suite | Vite, TypeScript | `frontend/src/` | required |
| **Workspace Shell & Honest Failure States** | E2E, regression protection | navigation, responsive layout, accessibility, chunk recovery, diagnostics failures | Playwright Suite | Live isolated backend and test admin | `frontend/e2e/workspace.spec.ts` | required |
| **Zero-Console Silent Launcher** | integration | regression protection | Launcher Suite | Windows, wscript | `launcher/launch.vbs` | required |

---

## 3. Cross-Boundary Contract Evidence

| Interface or message boundary | Single contract source | Contract validation | Consumer evidence | Provider evidence | Integration evidence | Assessment |
|---|---|---|---|---|---|---|
| **Telemetry & Metrics API** | `backend/app/domain/models.py` (`HostMetrics`) | `tests/test_api_contracts.py` | `frontend/src/lib/api.ts` (`HealthInfo`, `HostInfo`) | `backend/app/services/telemetry_service.py` | `GET /api/metrics` (200 OK) | covered |
| **Port Guard & Conflict Engine** | `backend/app/services/port_isolation_service.py` | `tests/test_port_isolation.py` | `frontend/src/pages/PortsPage.tsx` | `POST /api/ports/guard/check` | `tests/test_port_isolation.py` | covered |
| **4-Panel System History (SSE)** | `backend/app/api/router.py` (`/api/stream/telemetry`) | `tests/test_telemetry_history.py` | `frontend/src/components/CpuHistoryChart.tsx` | `GET /api/metrics/system-history` | Live Playwright SSE stream | covered |
| **JumpServer PAM Asset Directory** | `backend/app/domain/models.py` (`ManagedAsset`) | `tests/test_api_contracts.py` | `frontend/src/pages/BastionPage.tsx` | `GET /api/assets` | `GET /api/assets` (200 OK) | covered |

---

## 4. Required Test Points

### TEST-PORT-001 — Autonomous AI Port Isolation & Multi-User Conflict Resolution
- **State**: `covered`
- **Purpose**: `rule protection`, `critical path`
- **Source**: User requirement: *"اي بورت محجوز شغال خلاص يكون ليوزر معين وما يحق ليوزر اخر يتحكم فيه ويشوف المتصفح حقه... وافتح بورت اخر تلقائياً"*
- **Representative input**: User A claims port 3500; User B requests port 3500.
- **Observable expectation**: System flags `available: False`, `conflict: True`, identifies `current_owner: UserA`, and auto-allocates an unoccupied candidate port (e.g. 3501, 3502).
- **Level**: `unit`, `integration`
- **Execution group**: Backend Suite
- **Boundary**: In-memory socket probe and claim registry; no external network.
- **Test file**: `tests/test_port_isolation.py`
- **Test node**: `TestPortIsolation.test_occupied_port_conflict_detection`
- **Command**: `python -m unittest tests/test_port_isolation.py`
- **Evidence**: Exit code 0, 4 tests passed in 0.05s.

---

### TEST-OSC-002 — 4-Panel Ubuntu / GNOME Oscilloscope System Monitor
- **State**: `covered`
- **Purpose**: `rule protection`, `critical path`
- **Source**: User requirement: *"وشاتي مصفوفه الانويه تكون مثل الرسوم البيانيه الي رسلتها لك بالصوره حق اللابتوب"*
- **Representative input**: 60-second rolling buffer sampling CPU cores (up to 16), Memory & Swap, Network RX/TX, and Disk Read/Write.
- **Observable expectation**: Payload contains structured datasets for all 4 panels: `cpu.cores`, `memory.history` & `swap_history`, `network.rx_history` & `tx_history`, `disk.read_history` & `write_history`.
- **Level**: `integration`
- **Execution group**: Backend Suite
- **Boundary**: Native psutil counters with zero subprocess overhead.
- **Test file**: `tests/test_telemetry_history.py`
- **Test node**: `TestTelemetryHistory.test_get_system_history_4_panels`
- **Command**: `python -m unittest tests/test_telemetry_history.py`
- **Evidence**: Exit code 0, verified with live SSE pulse on port 8765.

---

### TEST-PAM-003 — JumpServer Bastion Command Risk ACL Regex Interceptor
- **State**: `covered`
- **Purpose**: `rule protection`, `security protection`
- **Source**: Cybersecurity hardening against accidental or malicious remote command execution.
- **Representative input**: Destructive inputs (`rm -rf /`, `dd if=/dev/zero`, `:(){ :|:& };:`, `format C:`, `shutdown /s /t 0`) vs administrative query inputs (`ls -la`, `uptime`, `whoami`, `dir`).
- **Observable expectation**: Destructive commands return `safe: False`, `risk_level: CRITICAL`, `requires_approval: True`. Safe commands return `safe: True`, `risk_level: LOW`.
- **Level**: `unit`
- **Execution group**: Security Suite
- **Boundary**: Pure regex AST evaluation in Python; zero OS side-effects.
- **Test file**: `tests/test_bastion_security.py`
- **Test node**: `TestBastionSecurity.test_block_critical_destructive_commands`
- **Command**: `python -m unittest tests/test_bastion_security.py`
- **Evidence**: Exit code 0, 2 tests passed covering 14 distinct shell commands.

---

### TEST-DATA-004 — Dual-Key JSON Contract & Dashboard Data Completeness
- **State**: `covered`
- **Purpose**: `regression protection`, `rule protection`
- **Source**: Defect in v1: Tables showing empty dashes `-` and `0 GB` due to field naming drift (`snake_case` vs `camelCase`).
- **Representative input**: Serialization of `HostMetrics`, `ManagedAsset`, `LocalUser`.
- **Observable expectation**: Serialized dictionaries must provide both casing styles (e.g. `used_ram` and `usedRam`, `full_name` and `fullName`, `is_rdp` and `isRdp`).
- **Level**: `contract`
- **Execution group**: Contract Suite
- **Boundary**: Python domain models `to_dict()` methods.
- **Test file**: `tests/test_api_contracts.py`
- **Test node**: `TestApiContracts.test_host_metrics_dual_keys`
- **Command**: `python -m unittest tests/test_api_contracts.py`
- **Evidence**: Exit code 0, 3 tests passed verifying complete contract parity.

---

### TEST-SILENT-005 — Zero-Console Window Execution Guarantee
- **State**: `covered`
- **Purpose**: `regression protection`
- **Source**: Defect in v1: `conhost.exe` and `cmd.exe` black popups flickering on screen every second.
- **Representative input**: Subprocess invocation and background launcher execution.
- **Observable expectation**: Subprocess calls explicitly supply `creationflags = 0x08000000` (`CREATE_NO_WINDOW`) and launcher runs via `wscript.exe` + `pythonw.exe` with `SW_HIDE = 0`.
- **Level**: `integration`
- **Execution group**: Launcher Suite
- **Boundary**: Win32 process creation flags.
- **Test file**: `launcher/launch.vbs`
- **Evidence**: Shortcut verified with PowerShell COM WScript.Shell, zero CMD popups during test execution.

---

## 5. Current Gaps and Actions

| Priority | TEST-ID or asset | Gap | Next action | State |
|---|---|---|---|---|
| **P1** | `TEST-WTS-007` | Automated mock for interactive Win32 desktop popups (`WTSSendMessageW`) | Add Win32 ctypes mock fixture for CI non-Windows environments | in progress |
| ~~**P2**~~ | `TEST-E2E-008` | Automated Playwright headless UI smoke run in CI pipeline | `frontend/e2e/smoke.spec.ts` + `e2e-smoke` job in `.github/workflows/ci.yml` (login, theme toggle, mobile overflow, governor console health) | done |

---

## 6. Maintenance Triggers

- **Test directories or configurations change**: Re-run discovery `python -m unittest discover -s tests -v`.
- **A new business rule or defect is discovered**: Assign a new `TEST-ID` before implementing changes.
- **API contracts or DTOs change**: Update `models.py` and run `test_api_contracts.py`.
- **Before stage delivery**: Ensure all 11 unit & contract tests pass with 0 failures.
