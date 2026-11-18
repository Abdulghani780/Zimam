# Graph Report - ASAAS-Server-Control-v2  (2026-11-17)

## Corpus Check
- 236 files · ~212,110 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 65 file(s) not represented in the graph (top: .woff2 30, .css 17, (none) 5)

## Summary
- 2383 nodes · 5542 edges · 143 communities (108 shown, 35 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 202 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a318bd8e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.py
- .do_GET
- api.py
- router.py
- react
- json
- t
- app.py
- EnterpriseV30Tests
- TelemetryService
- api.ts
- domain/models.py
- with
- 2. مراحل العمل الرئيسية
- PortIsolationService
- ZIMAM Console — خطة إعادة التصميم الشاملة (Signature Edition)
- App.tsx
- zimam-ui/index.ts
- asaas-ui/index.ts
- append_audit
- BastionPage.tsx
- Frontend patterns
- .list_active_sessions
- DeveloperWorkspaceManager
- storage.py
- PortsPage.tsx
- UsersPage.tsx
- gateway_session
- ControlPage.tsx
- Icon
- package.json
- zimam-ui/assistant/AssistantPanel.tsx
- cx
- ZIMAM — خطة تحويل المشروع إلى منتج تجاري
- kitText
- test_security_primitives.py
- asaas-ui/ui/Icon.tsx
- UserService
- hashlib
- apiV1.ts
- zimam-ui/lib/format.ts
- compilerOptions
- asaas-ui/lib/format.ts
- ManagedAsset
- دليل نظام التصميم والتوكنز الموحد (ZIMAM Sovereign Design System Guide)
- agent/Program.cs
- StorageService
- GovernorService
- TESTS.md — Test Assets and Required Test Points
- issue_mtls_certs.py
- compilerOptions
- install.mjs
- ASAAS AI Skills
- JobSigner
- StorageBreakdown
- AgentWorker
- Components and helpers
- assemble-from-fund.cjs
- DatabaseService
- Build AI Agents
- Web, API, identity, and data controls
- Mobile Foundation
- React Native Foundation
- AgentWorker.ExecuteJob
- ._authenticate
- init_db
- EnvelopeVault
- LLM Integration
- bastion_service.py
- End User License Agreement — ZIMAM
- ZIMAM â€” Installation & Operations Guide
- Project Structure
- Verification and reporting
- asaas-ui/ui/Modal.tsx
- visual-audit.spec.ts
- InfrastructurePage.tsx
- zimam-ui/ui/PasswordInput.tsx
- Program
- Database and Migrations
- FastAPI Implementation Patterns
- Backend Foundation
- Security Review
- ==============================================================================
- ==============================================================================
- launcher/Program.cs
- zimam-ui/ui/MonthSwitcher.tsx
- ai/SKILL.md
- AI Foundation
- AI and ML systems
- asaas-ui/ui/MonthSwitcher.tsx
- ==============================================================================
- ==============================================================================
- @playwright/test
- 🚀 طريقة التشغيل
- Audit orchestration and coverage
- Clients, native software, and devices
- Platform and software supply chain
- Services, data systems, and packages
- Sources and currency
- Specialized systems
- DomainService
- _GuacdReader
- Privacy Policy — ZIMAM
- Service Level Agreement — ZIMAM (template)
- dependencies
- zimam-ui/ui/Modal.tsx
- Evaluation
- RAG on Qdrant
- AI-Heavy Projects
- Asaas UI kit
- Zimam.Agent.csproj
- serve.py
- scripts
- Assistant Pattern
- Asaas brand: colours, type, voice
- ZIMAM enterprise control plane
- GlobalErrorBoundary
- ZIMAM Windows Agent
- UserSession
- DualStackServer
- ZIMAM Control Plane
- ZIMAM — خطة المعالجة الشاملة
- _load_dotenv
- generate_self_signed_cert
- ZimamLauncher.csproj
- tsconfig.json
- AgentJobDto

## God Nodes (most connected - your core abstractions)
1. `t()` - 91 edges
2. `react` - 74 edges
3. `get_db_connection()` - 71 edges
4. `Button()` - 63 edges
5. `User` - 57 edges
6. `db_session()` - 54 edges
7. `useToast()` - 50 edges
8. `ZimamApiHandler` - 40 edges
9. `Glass()` - 37 edges
10. `Card()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `Vault slice (implemented)` --references--> `_require_writer()`  [INFERRED]
  docs/MIGRATION_PLAN.md → control_plane/zimam_control/api.py
- `3. Cross-Boundary Contract Evidence` --references--> `HostMetrics`  [INFERRED]
  TESTS.md → backend/app/domain/models.py
- `3. Cross-Boundary Contract Evidence` --references--> `ManagedAsset`  [INFERRED]
  TESTS.md → backend/app/domain/models.py
- `Mapping: legacy surface → `/api/v1`` --references--> `JobSigner`  [INFERRED]
  docs/MIGRATION_PLAN.md → control_plane/zimam_control/signing.py
- `Identity unification (decision: v1 is the authority)` --references--> `sync_legacy_identities()`  [INFERRED]
  docs/MIGRATION_PLAN.md → control_plane/zimam_control/storage.py

## Import Cycles
- None detected.

## Communities (143 total, 35 thin omitted)

### Community 0 - "db.py"
Cohesion: 0.06
Nodes (57): db_add_asset(), db_add_security_event(), db_add_server(), db_add_user_notification(), db_add_vault_account(), db_approve_jit_grant(), db_authenticate_user(), db_change_user_password() (+49 more)

### Community 1 - ".do_GET"
Cohesion: 0.05
Nodes (18): ZimamApiHandler, get_silent_kwargs(), popen_silent(), run_silent(), CertificatesProvider, DockerProvider, EventViewerProvider, FirewallProvider (+10 more)

### Community 2 - "api.py"
Cohesion: 0.07
Nodes (75): AccountRequest, agent_latest_results(), AgentHeartbeat, AgentJobResult, AssetRequest, audit_events(), BootstrapRequest, _check_capacity() (+67 more)

### Community 3 - "router.py"
Cohesion: 0.06
Nodes (12): get_or_create_session_token(), ActionEngine, RiskLevel, _tcp_ping(), _enable_windows_privileges(), Win32WtsService, WTS_PROCESS_INFO, WTS_SESSION_INFO (+4 more)

### Community 4 - "react"
Cohesion: 0.09
Nodes (38): AiDiagModal(), AiDiagModalProps, HeaderBar(), HeaderBarProps, Layout(), PageErrorBoundary, DRAWER_LINKS, MobileNavigation() (+30 more)

### Community 5 - "json"
Cohesion: 0.08
Nodes (16): _keypair(), LicenseTests, _payload(), _sign(), _bool(), activate_license(), _b64url_decode(), _canonical() (+8 more)

### Community 6 - "t"
Cohesion: 0.16
Nodes (38): BroadcastModal(), BroadcastModalProps, GovernorSettingsModal(), GovernorSettingsModalProps, Phase, RemoteSession(), RemoteSessionProps, UserAccountModal() (+30 more)

### Community 7 - "app.py"
Cohesion: 0.07
Nodes (16): _backup_loop(), lifespan(), spa(), create_backup(), _db_path(), prune_backups(), check_feature(), _is_whitelisted() (+8 more)

### Community 8 - "EnterpriseV30Tests"
Cohesion: 0.07
Nodes (5): EnterpriseV25Tests, _get(), _post(), EnterpriseV30Tests, LegacySecurityBaselineTests

### Community 9 - "TelemetryService"
Cohesion: 0.07
Nodes (8): PROCESS_MEMORY_COUNTERS, PROCESSENTRY32, AlertService, _async_send(), mask_secret(), TelemetryService, TEST-OSC-002 — 4-Panel Ubuntu / GNOME Oscilloscope System Monitor, TestTelemetryHistory

### Community 10 - "api.ts"
Cohesion: 0.08
Nodes (37): axisLabels(), buildPath(), ChartPoint, CpuHistoryChart(), CpuHistoryChartProps, axisLabels(), buildArea(), buildLine() (+29 more)

### Community 11 - "domain/models.py"
Cohesion: 0.07
Nodes (18): ActionJobRecord, CertificateItem, DeveloperProject, DockerContainerItem, FirewallRuleItem, NetworkAdapterItem, PortClaim, ProcessDetail (+10 more)

### Community 12 - "with"
Cohesion: 0.06
Nodes (38): name, needs, runs-on, steps, E2E_PASS, E2E_USER, PYTHONPATH, jobs (+30 more)

### Community 13 - "2. مراحل العمل الرئيسية"
Cohesion: 0.05
Nodes (37): 1. الرؤية العامة, 2. مراحل العمل الرئيسية, 3.1 تطبيق هوية `skills/frontend` حرفياً, 3.2 إصلاح التعارضات في CSS, 3.3 إصلاح الترميز (Mojibake), 3.4 إصلاح مشاكل التخطيط الحقيقية, 3.5 أداة التدقيق, 3. commits Git الرئيسية (+29 more)

### Community 14 - "PortIsolationService"
Cohesion: 0.09
Nodes (4): db_remove_reservation(), db_set_reservation(), PortIsolationService, TestPortIsolation

### Community 15 - "ZIMAM Console — خطة إعادة التصميم الشاملة (Signature Edition)"
Cohesion: 0.06
Nodes (35): 10. مراحل التنفيذ, 11 — معايير القبول, 12. مخاطر & قرارات, 1. الرؤية — "المقصورة السيادية", 2. مراجع Pinterest — اتجاهات مختارة, 3.1 الألوان (dark theme is canonical — شاشة عمليات ليلية), 3.2 الزجاج — ثلاث درجات فقط (Apple material hierarchy), 3.3 التايبوغرافي — ثمانية بخطة three-tier (+27 more)

### Community 16 - "App.tsx"
Cohesion: 0.11
Nodes (30): AgentsPage, App(), AssetsPage, AuditPage, BastionPage, ContainersPage, ControlPage, DatabasesPage (+22 more)

### Community 17 - "zimam-ui/index.ts"
Cohesion: 0.13
Nodes (25): initials(), ar, dictionaries, en, KitLang, kitLang(), kitText(), KitTextKey (+17 more)

### Community 18 - "asaas-ui/index.ts"
Cohesion: 0.10
Nodes (25): initials(), KitTextKey, savedTheme(), Theme, useTheme(), Ambient(), Field(), FieldProps (+17 more)

### Community 19 - "append_audit"
Cohesion: 0.13
Nodes (18): main(), bootstrap(), _bootstrap_token(), create_account(), create_asset(), create_job(), create_policy(), _job_signature_payload() (+10 more)

### Community 20 - "BastionPage.tsx"
Cohesion: 0.09
Nodes (28): JitGrant, AssetFormState, assetStatusMeta(), BastionPage(), ConfirmKind, CONNECT_PROTOCOLS, DetailRow(), DURATION_OPTIONS (+20 more)

### Community 21 - "Frontend patterns"
Cohesion: 0.07
Nodes (27): API client and data loading, Build and delivery, Configuration, Contents, Frontend patterns, Language and direction, Layout, header and phone menu, Page titles and SEO (+19 more)

### Community 23 - "DeveloperWorkspaceManager"
Cohesion: 0.12
Nodes (4): db_list_developer_projects(), db_update_project_status(), DeveloperWorkspaceManager, SmartPortOrchestrator

### Community 24 - "storage.py"
Cohesion: 0.12
Nodes (16): download_agent_update(), _update_bundle_dir(), _update_manifest(), resolve_data_path(), resolve_database_path(), AccessPolicyRow, Account, AgentJob (+8 more)

### Community 25 - "PortsPage.tsx"
Cohesion: 0.11
Nodes (26): PortItem, buildReservationMap(), ConfirmCopy, ConfirmState, csvCell(), describeConfirm(), formatNumber(), GuardReservation (+18 more)

### Community 26 - "UsersPage.tsx"
Cohesion: 0.28
Nodes (21): apiV1, AgentsPage(), asArray(), COLLECTOR_JOB_TYPES, JOB_TYPES, AuditPage(), FleetSecAgent, ResultEntry (+13 more)

### Community 27 - "gateway_session"
Cohesion: 0.12
Nodes (8): gateway_session(), _recv(), _elem(), enabled(), encode_instruction(), GuacdSession, open_session(), parse_instruction()

### Community 28 - "ControlPage.tsx"
Cohesion: 0.18
Nodes (22): DetailRow(), SessionDrawer(), SessionDrawerProps, UserSession, formatLoginTimestamp(), formatSessionDuration(), parseLogonDate(), sessionIdleLabel() (+14 more)

### Community 29 - "Icon"
Cohesion: 0.15
Nodes (17): AssistantFace(), AssistantMood, AssistantRobot(), FACES, greeting(), AssistantAnswer, AssistantConfig, AssistantMessage (+9 more)

### Community 30 - "package.json"
Cohesion: 0.12
Nodes (23): devDependencies, autoprefixer@^10.6.2, oxlint@^1.90.0, postcss@^8.5.32, tailwindcss@^3.4.17, @types/guacamole-common-js@^1.5.5, @types/node@^24.19.2, @types/react@^19.3.0 (+15 more)

### Community 31 - "zimam-ui/assistant/AssistantPanel.tsx"
Cohesion: 0.14
Nodes (16): AssistantFace(), AssistantMood, AssistantRobot(), FACES, greeting(), AssistantAnswer, AssistantConfig, AssistantMessage (+8 more)

### Community 32 - "cx"
Cohesion: 0.16
Nodes (18): cx(), ButtonProps, CardProps, GlassProps, DIRECTIONAL, Icon(), IconName, paths (+10 more)

### Community 33 - "ZIMAM — خطة تحويل المشروع إلى منتج تجاري"
Cohesion: 0.09
Nodes (21): 1. المعمارية المستهدفة للمنتج, 2.1 المكونات القابلة للتغليف, 2.2 أدوات البناء (تُثبَّت على جهاز التطوير فقط), 2.3 محتوى الـ MSI (Inno Setup), 2.4_FIRST RUN WIZARD_ (صفحة `/setup` في الواجهة), 2. خط الأنابيب — من كود إلى MSI, 3.1 الفكرة — License موقّع Ed25519, 3.2 الباقات المقترحة (+13 more)

### Community 34 - "kitText"
Cohesion: 0.16
Nodes (18): ar, dictionaries, en, KitLang, kitLang(), kitText(), setKitText(), COMMON (+10 more)

### Community 35 - "test_security_primitives.py"
Cohesion: 0.20
Nodes (9): ConnectionTokenTests, PermissionEngineTests, issue_connection_token(), ConnectionClaims, ConnectionTokenStore, AccessContext, AccessPolicy, _matches() (+1 more)

### Community 36 - "asaas-ui/ui/Icon.tsx"
Cohesion: 0.14
Nodes (17): react-dom, ButtonProps, Card(), CardProps, Glass(), GlassProps, DIRECTIONAL, IconName (+9 more)

### Community 37 - "UserService"
Cohesion: 0.14
Nodes (3): UserService, _USER_INFO_1, _USER_INFO_1003

### Community 38 - "hashlib"
Cohesion: 0.19
Nodes (7): AuditChainTests, verify_audit(), AuditChain, AuditRecord, AuditVerification, _canonical(), verify_legacy_password()

### Community 39 - "apiV1.ts"
Cohesion: 0.12
Nodes (17): ApiV1Error, post(), request(), V1AccessPolicy, V1Account, V1Agent, V1AgentJob, V1Asset (+9 more)

### Community 40 - "zimam-ui/lib/format.ts"
Cohesion: 0.13
Nodes (16): compact, CURRENCY, formatMoney(), formatMonthShort(), formatNumber(), formatSigned(), fullDate, isolate() (+8 more)

### Community 41 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 42 - "asaas-ui/lib/format.ts"
Cohesion: 0.14
Nodes (16): compact, CURRENCY, formatMoney(), formatMonthShort(), formatNumber(), formatSigned(), fullDate, isolate() (+8 more)

### Community 43 - "ManagedAsset"
Cohesion: 0.18
Nodes (5): HostMetrics, LocalUser, ManagedAsset, TestApiContracts, TEST-DATA-004 — Dual-Key JSON Contract & Dashboard Data Completeness

### Community 44 - "دليل نظام التصميم والتوكنز الموحد (ZIMAM Sovereign Design System Guide)"
Cohesion: 0.11
Nodes (18): 1. الهيكل المعماري ثلاثي الطبقات (Three-Layer Token Architecture), 2. ملفات النظام ومساراتها في المشروع (File Structure), 3.1 الطبقة الأساسية (Primitives), 3.2 الطبقة الوظيفية (Semantic Tokens), 3.3 طبقة المكونات (Component Tokens), 3. كتالوج المتغيرات الكامل (Tokens Catalog), 4. جدول فئات Tailwind المدمجة (Tailwind Utility Mapping), 5. أمثلة برمجية عملية للمطورين (Copy-Paste Component Recipes) (+10 more)

### Community 45 - "agent/Program.cs"
Cohesion: 0.11
Nodes (4): FeatureProbe, FirewallProbe, NetworkProbe, PsProbe

### Community 48 - "TESTS.md — Test Assets and Required Test Points"
Cohesion: 0.12
Nodes (10): 1. Test Entry Points, 2. Test Asset Map, 3. Cross-Boundary Contract Evidence, 4. Required Test Points, 5. Current Gaps and Actions, 6. Maintenance Triggers, TEST-PAM-003 — JumpServer Bastion Command Risk ACL Regex Interceptor, TEST-PORT-001 — Autonomous AI Port Isolation & Multi-User Conflict Resolution (+2 more)

### Community 49 - "issue_mtls_certs.py"
Cohesion: 0.20
Nodes (6): _cert(), _key(), main(), _name(), _write_pair(), main()

### Community 50 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 51 - "install.mjs"
Cohesion: 0.12
Nodes (10): routes, viewports, args, force, indexPath, kit, mainPath, project (+2 more)

### Community 52 - "ASAAS AI Skills"
Cohesion: 0.12
Nodes (16): 1. Pick one clear responsibility, 2. Add `SKILL.md`, 3. Add supporting resources only when useful, 4. Test the workflow, ASAAS AI Skills, Create a custom task skill, For area leaders, For custom task skills (+8 more)

### Community 53 - "JobSigner"
Cohesion: 0.13
Nodes (7): JobSigningTests, JobSigner, Mapping: legacy surface → `/api/v1`, Rules, Session bridge (auth slice, implemented), Vault slice (implemented), ZIMAM Legacy → Control Plane Migration Plan

### Community 54 - "StorageBreakdown"
Cohesion: 0.13
Nodes (9): 1. Executive Forensic Summary, 2.1 Buttons, Modals & User Actions (Frontend), 2.2 Zero-Mock & Native Windows Compliance (Backend), 2.3 Visual Luxury & Brand Standards, 2. Granular Inspection Details, 3. Final Certification, ZIMAM Enterprise v3.0 — Forensic Rescue & Audit Report, StorageBreakdown (+1 more)

### Community 56 - "Components and helpers"
Cohesion: 0.14
Nodes (13): Actions, Components and helpers, Contents, Data display, Feedback, Forms, Helpers, Icons (+5 more)

### Community 57 - "assemble-from-fund.cjs"
Cohesion: 0.14
Nodes (8): assistant, format, fs, layout, path, period, status, theme

### Community 59 - "Build AI Agents"
Cohesion: 0.15
Nodes (13): Architecture and Agent Design, Boundaries, Build AI Agents, CrewAI Standard, Decide Whether Agents Are Needed, Evaluation, Goal, Implementation Workflow (+5 more)

### Community 60 - "Web, API, identity, and data controls"
Cohesion: 0.15
Nodes (13): APIs, resource use, and protocol boundaries, Authentication and account lifecycle, Authorization and tenant isolation, Browser output and CSP, CSRF and CORS, Data exposure, errors, and privacy, Files, uploads, downloads, and archives, Injection and unsafe execution (+5 more)

### Community 61 - "Mobile Foundation"
Cohesion: 0.15
Nodes (12): Accessibility And Responsiveness, Boundaries, Default Stack, Dependency And Modularity Rules, Goal, Implementation Rules, Mobile Foundation, Modular Design And Clean Architecture (+4 more)

### Community 62 - "React Native Foundation"
Cohesion: 0.15
Nodes (12): Accessibility And Responsiveness, Boundaries, Default Stack, Dependency And Modularity Rules, Goal, Implementation Rules, Modular Design And Clean Architecture, New Project Intake (+4 more)

### Community 63 - "AgentWorker.ExecuteJob"
Cohesion: 0.23
Nodes (4): EventLogProbe, ServiceProbe, SessionProbe, SoftwareProbe

### Community 64 - "._authenticate"
Cohesion: 0.18
Nodes (3): _extract_blocked_ips(), db_sync_proxied_user(), Identity unification (decision: v1 is the authority)

### Community 65 - "init_db"
Cohesion: 0.20
Nodes (6): db_bootstrap_admin(), db_get_system_metadata(), init_db(), _legacy_accounts_disabled(), _reject_legacy_username(), main()

### Community 66 - "EnvelopeVault"
Cohesion: 0.26
Nodes (3): EnvelopeVaultTests, EnvelopeVault, SealedSecret

### Community 67 - "LLM Integration"
Cohesion: 0.17
Nodes (10): Settings, Budgets and limits, Contents, LLM Integration, Logging and privacy, One provider client, Prompts, Settings and wiring (+2 more)

### Community 68 - "bastion_service.py"
Cohesion: 0.24
Nodes (3): db_remove_asset(), BastionService, TestBastionSecurity

### Community 69 - "End User License Agreement — ZIMAM"
Cohesion: 0.18
Nodes (10): 1. License grant, 2. Ownership, 3. Restrictions, 4. Trial, 5. Data & privacy, 6. Warranty disclaimer, 7. Limitation of liability, 8. Termination (+2 more)

### Community 70 - "ZIMAM â€” Installation & Operations Guide"
Cohesion: 0.18
Nodes (10): Agents, Backups, Configuration, First boot, Logs & health, Remote sessions (guacd), TLS, Uninstall (+2 more)

### Community 71 - "Project Structure"
Cohesion: 0.18
Nodes (10): Application root, Baseline Layout, Choosing a Module Boundary, Growing a Module, Modules, Optional Project Files, Project Structure, Responsibilities (+2 more)

### Community 72 - "Verification and reporting"
Cohesion: 0.18
Nodes (10): Before executing tools, Candidate validation, Coverage and execution record, Cross-component verification, Finding template, High-value negative and positive tests, Remediation and release decision, Select checks by question (+2 more)

### Community 73 - "asaas-ui/ui/Modal.tsx"
Cohesion: 0.42
Nodes (7): cx(), Button(), ConfirmDialog(), ConfirmDialogProps, FormError(), Modal(), ModalProps

### Community 74 - "visual-audit.spec.ts"
Cohesion: 0.20
Nodes (6): pagesToAudit, screenshotDir, vite@^8.3.6, @vitejs/plugin-react@^6.1.2, vite, @vitejs/plugin-react

### Community 75 - "InfrastructurePage.tsx"
Cohesion: 0.29
Nodes (9): agentRows(), FleetNetAgent, InfrastructurePage(), NetIface, netIfaces(), pickField(), RemoteService, ResultEntry (+1 more)

### Community 76 - "zimam-ui/ui/PasswordInput.tsx"
Cohesion: 0.31
Nodes (8): COMMON, hasSequence(), passwordStrength(), SEQUENCES, strengthLabel(), StrengthLevel, PasswordInputProps, PasswordStrength()

### Community 78 - "Database and Migrations"
Cohesion: 0.20
Nodes (9): Central SQLite Wrapper, Database and Migrations, Database Selection, Fresh Installs and Upgrades, Migration Model, Query Safety, Schema-Change Workflow, SQLite Configuration (+1 more)

### Community 79 - "FastAPI Implementation Patterns"
Cohesion: 0.20
Nodes (9): Application Lifecycle, Async Boundaries, Errors and Logging, FastAPI Implementation Patterns, Repositories, Routers, Schemas, Services (+1 more)

### Community 80 - "Backend Foundation"
Cohesion: 0.20
Nodes (10): Architecture, Backend Foundation, Boundaries, Database and Migrations, Default Stack, Goal, Implementation Rules, New Project Intake (+2 more)

### Community 81 - "Security Review"
Cohesion: 0.20
Nodes (10): 1. Select the work mode, 2. Establish context before deciding controls, 3. Load only the relevant guidance, 4. Review the actual security boundary, 5. Work safely without obstructing authorized work, 6. Implement or remediate at the root cause, 7. Verify and triage with evidence, 8. Deliver actionable results (+2 more)

### Community 82 - "=============================================================================="
Cohesion: 0.22
Nodes (9): ==============================================================================, 1. المسح الجنائي للواجهات (Frontend Forensic Scan), 2. مطابقة الصفحات والقائمة الجانبية (Pages & Navigation Audit), 3. تدقيق الباك إند (Backend Logic & APIs Audit), 4. 🚨 البناء الإلزامي للفرونت إند (Mandatory Frontend Build Gate), المسار: .agent/workflows/audit_and_fix.md, الهدف, 🔍 خطوات الفحص والإصلاح الإلزامية (+1 more)

### Community 83 - "=============================================================================="
Cohesion: 0.22
Nodes (9): ==============================================================================, المرحلة 1: طبقة الباك إند والخدمات (Backend / Infrastructure), المرحلة 2: طبقة الفرونت إند والصفحات (Frontend UI), المرحلة 3: البناء الإجباري ونقل المخرجات إلى dist/ (Mandatory Dist Build), المرحلة 4: التحقق والجودة (Verification & Zero Mock), المسار: .agent/workflows/feature_implementation.md, الهدف, سير عمل تنفيذ الميزات المتكاملة (Feature Implementation Workflow) (+1 more)

### Community 85 - "zimam-ui/ui/MonthSwitcher.tsx"
Cohesion: 0.47
Nodes (7): formatPeriod(), currentPeriod(), pad(), periodBounds(), shiftPeriod(), today(), MonthSwitcher()

### Community 86 - "ai/SKILL.md"
Cohesion: 0.28
Nodes (3): Mount it, Server side, The Asaas robot assistant

### Community 87 - "AI Foundation"
Cohesion: 0.22
Nodes (9): AI Foundation, ASAAS Defaults, Boundaries, Choose The Capability, Goal, Implementation Rules, Start With Context, Where Code Lives (+1 more)

### Community 88 - "AI and ML systems"
Cohesion: 0.22
Nodes (9): Adversarial model evaluation, AI and ML systems, Datasets and preprocessing, Inference, integration, and release, Model and lifecycle inventory, Model formats, loading, and conversion, Required verification record, Training and fine-tuning execution (+1 more)

### Community 89 - "asaas-ui/ui/MonthSwitcher.tsx"
Cohesion: 0.47
Nodes (7): formatPeriod(), currentPeriod(), pad(), periodBounds(), shiftPeriod(), today(), MonthSwitcher()

### Community 90 - "=============================================================================="
Cohesion: 0.25
Nodes (8): ==============================================================================, 1. تسجيل الصفحات الجديدة (Route & Sidebar Registration), 2. البناء الإلزامي وتحديث مجلد التوزيع (Mandatory Dist Build), ⚠️ الشروط الإجبارية غير القابلة للتجاوز (Mandatory Gates), المسار: .agent/workflows/frontend_development.md, الهدف, سير عمل تطوير واجهات الفرونت إند (Frontend Development Workflow), 🎨 معايير الواجهات الفخمة (Luxury UI Checklist)

### Community 91 - "=============================================================================="
Cohesion: 0.25
Nodes (8): ==============================================================================, 1. تدقيق التناسق البرمجي, 2. توليد حزمة الإنتاج وتحديث dist/ (Mandatory Production Build), 3. الفحص التشغيلي في المتصفح, المسار: .agent/workflows/release_and_build.md, الهدف, سير عمل البناء والتجهيز للإنتاج (Release & Build Workflow), 🚀 قائمة فحص الإصدار والبناء (Release Checklist)

### Community 93 - "🚀 طريقة التشغيل"
Cohesion: 0.25
Nodes (7): Control Plane المؤسسي (`/api/v1`):, 💎 أبرز المزايا المحققة في v2, 🏛️ المعمارية البرمجية (Clean Architecture & OOP), تشغيل المطورين (Developer Console):, تشغيل سطح المكتب (موصى به للمستخدم النهائي):, 🚀 طريقة التشغيل, منظومة ZIMAM & Resource Governor Enterprise v2.5

### Community 95 - "Audit orchestration and coverage"
Cohesion: 0.25
Nodes (8): 1. Discover the real project, 2. Map lifecycle and trust, 3. Apply a universal baseline to every component, 4. Expand into domain profiles, 5. Build the coverage and test plan, 6. Execute in passes and reconcile findings, 7. Stop on evidence-based completion, Audit orchestration and coverage

### Community 96 - "Clients, native software, and devices"
Cohesion: 0.25
Nodes (8): Browser, editor, and host extensions, Clients, native software, and devices, Desktop and command-line software, Embedded devices, firmware, and IoT, Mobile applications, Native code, runtimes, and privileged OS components, Robotics, OT, and physical systems, Verification matrix

### Community 97 - "Platform and software supply chain"
Cohesion: 0.25
Nodes (8): CI/CD and release integrity, Cloud, containers, and infrastructure as code, Cryptography and transport, Dependencies and vulnerability triage, Logging, detection, and response, Platform and software supply chain, Secrets and workload identity, Secure lifecycle and exceptional conditions

### Community 98 - "Services, data systems, and packages"
Cohesion: 0.25
Nodes (8): Build-only, infrastructure-only, and configuration-only projects, Databases, object stores, and data platforms, Domain verification matrix, ETL, batch, streaming, notebooks, and automation, Games, simulation, scientific computing, and HPC, Libraries, frameworks, SDKs, and reusable packages, Network services, protocols, and distributed systems, Services, data systems, and packages

### Community 99 - "Sources and currency"
Cohesion: 0.25
Nodes (7): Additional primary sources for universal project coverage, How to use sources, Maintenance triggers, Official platform and protocol guidance, OWASP implementation guidance, Sources and currency, Standards and prioritization

### Community 100 - "Specialized systems"
Cohesion: 0.25
Nodes (8): AI applications, retrieval, and agent tools, Business logic, transactions, and concurrency, Mobile and native applications, Next.js and similar server/client frameworks, Payments and signed webhooks, PostgreSQL and Supabase, Specialized systems, Wallet authentication and blockchain

### Community 103 - "Privacy Policy — ZIMAM"
Cohesion: 0.29
Nodes (6): Contact, Privacy Policy — ZIMAM, What the appliance stores (on your infrastructure), What we never do, What ZIMAM (the vendor) may receive — opt-in only, Your controls

### Community 104 - "Service Level Agreement — ZIMAM (template)"
Cohesion: 0.29
Nodes (6): Availability, Covered, Not covered, Remedies, Service Level Agreement — ZIMAM (template), Support channels

### Community 105 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, guacamole-common-js@^1.5.0, lucide-react@^1.70.0, react@^19.3.1, react-dom@^19.3.1, react-router-dom@^7.18.5, guacamole-common-js

### Community 106 - "zimam-ui/ui/Modal.tsx"
Cohesion: 0.38
Nodes (5): ModalProps, StretchProps, Swash(), SWASH_LETTERS, swashIndex()

### Community 107 - "Evaluation"
Cohesion: 0.29
Nodes (6): Cases, Checks, Evaluation, How to use the results, Runner, Where it lives

### Community 108 - "RAG on Qdrant"
Cohesion: 0.29
Nodes (6): Answering with citations, Decisions, Ingestion and search, Ingestion pipeline, RAG on Qdrant, Re-indexing

### Community 109 - "AI-Heavy Projects"
Cohesion: 0.29
Nodes (7): AI-Heavy Projects, Comparison and Diagnosis, Component Pipelines, Example, Orchestration and Decisions, Process Boundaries, Replaceable Components

### Community 110 - "Asaas UI kit"
Cohesion: 0.29
Nodes (6): Asaas UI kit, Fonts licence, Ground rules (why the kit looks the way it does), Keeping the kit in sync, Set up a project, What is not in the kit

### Community 111 - "Zimam.Agent.csproj"
Cohesion: 0.33
Nodes (5): net10.0-windows, Microsoft.Extensions.Hosting.WindowsServices (10.0.0), Microsoft.Extensions.Http (10.0.0), NSec.Cryptography (18.6.0), Microsoft.NET.Sdk.Worker

### Community 113 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test:e2e

### Community 114 - "Assistant Pattern"
Cohesion: 0.33
Nodes (6): Assistant Pattern, Contract with the widget, Evaluate before shipping, Router and rate limit, Rules that came from real failures, Service

### Community 115 - "Asaas brand: colours, type, voice"
Cohesion: 0.33
Nodes (5): Asaas brand: colours, type, voice, Colours, Logo, Type: Thmanyah, Voice (Arabic copy)

### Community 116 - "ZIMAM enterprise control plane"
Cohesion: 0.40
Nodes (4): Explicit release gates still open, Implemented foundation, Legacy API bridge, ZIMAM enterprise control plane

### Community 118 - "ZIMAM Windows Agent"
Cohesion: 0.50
Nodes (3): Service installation, Signed job channel, ZIMAM Windows Agent

### Community 121 - "ZIMAM Control Plane"
Cohesion: 0.50
Nodes (3): Configuration, Local run, ZIMAM Control Plane

### Community 122 - "ZIMAM — خطة المعالجة الشاملة"
Cohesion: 0.50
Nodes (3): ZIMAM — خطة المعالجة الشاملة, ⏳ متبقٍ (يحتاج جلسات مستقلة), ✅ منجز

## Knowledge Gaps
- **7 isolated node(s):** `net10.0-windows`, `Microsoft.Extensions.Hosting.WindowsServices (10.0.0)`, `Microsoft.Extensions.Http (10.0.0)`, `NSec.Cryptography (18.6.0)`, `Microsoft.NET.Sdk.Worker` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1045 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `3. Cross-Boundary Contract Evidence` connect `TESTS.md — Test Assets and Required Test Points` to `ManagedAsset`, `react`?**
  _High betweenness centrality (0.299) - this node is a cross-community bridge._
- **What connects `net10.0-windows`, `Microsoft.Extensions.Hosting.WindowsServices (10.0.0)`, `Microsoft.Extensions.Http (10.0.0)` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db.py` be split into smaller, more focused modules?**
  _Cohesion score 0.055593685655456415 - nodes in this community are weakly interconnected._
- **Why does `HealthInfo` connect `react` to `TESTS.md — Test Assets and Required Test Points`, `api.ts`?**
  _High betweenness centrality (0.298) - this node is a cross-community bridge._
- **Should `.do_GET` be split into smaller, more focused modules?**
  _Cohesion score 0.04806687565308255 - nodes in this community are weakly interconnected._
- **Why does `ManagedAsset` connect `ManagedAsset` to `db.py`, `.do_GET`, `router.py`, `bastion_service.py`, `domain/models.py`, `TESTS.md — Test Assets and Required Test Points`?**
  _High betweenness centrality (0.237) - this node is a cross-community bridge._
- **Should `api.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07027168234064786 - nodes in this community are weakly interconnected._