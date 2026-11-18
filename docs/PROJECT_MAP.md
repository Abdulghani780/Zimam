# خريطة المشروع الكاملة — ASAAS Server Control

> **آخر تحديث:** 2026-11-17 — بعد اكتمال المرحلة 0 (الهوية) والمرحلة 1 (البيانات الوهمية).
> هذا الملف هو المرجع الوحيد "أنت هنا / وش باقي" — حدّثه مع كل مرحلة.

---

## 1. وش المشروع؟

**ASAAS Server Control** = جهاز/برنامج Windows لإدارة ومراقبة الخوادم — بديل محلي عن JumpServer/ PAM:

- لوحة تحكم ويب (SPA) عربية RTL + إنجليزية
- agents على كل خادم يجمعون قياسات حقيقية (موقّعة Ed25519)
- جلسات RDP/SSH/VNC عبر Guacamole gateway
- صلاحيات مؤقتة JIT + vault credentials + audit chain مشفّر
- هوية بصرية رسمية من `AI-ASAAS/skills` (`asaas-ui` kit)

---

## 2. البنية (الطبقات)

```
┌─ frontend/        React SPA → dist → يُقدَّم من control_plane
├─ control_plane/   asaas_control — API v1 + proxy + auth/MFA + vault + license
│                   (FastAPI, :8876 loopback)
├─ backend/         Legacy admin API (~100 endpoints) :8765 loopback
│                   └─ جسر الهوية: X-ASAAS-Proxy-* headers من الـ proxy فقط
├─ agent/           Asaas.Agent.exe — C# Windows service، 19+ collector، jobs موقّعة
├─ launcher/        AsaasLauncher — يشغّل backend+control_plane ويفتح المتصفح
├─ packaging/       asaas.iss → ASAAS-Setup-x.y.z.exe (Inno Setup)
├─ tools/           build-release.ps1, gen-server-cert.py, sign-license.py
└─ data/            DBs حية + مفاتيح + tls (runtime فقط)
```

---

## 3. الحالة الفعلية لكل طبقة

| الطبقة | الحالة | الدليل |
|---|---|---|
| Frontend | ✅ هوية ASAAS رسمية + 0 أخطاء build | commit `feat(ui): restore official ASAAS identity` |
| Control plane v1 | ✅ auth+MFA, agents/jobs, audit chain, vault, license, fleet | `CONTROL_PLANE.md` |
| Guacamole gateway | ✅ RDP/SSH/telnet/vnc e2e مُختبر (guacd 1.6.0) | CONTROL_PLANE.md |
| Agent | ✅ collectors موقّعة Ed25519، e2e verified | agent/Program.cs |
| الأمان | ✅ loopback-only, origin fix, proxy bridge, per-user shortcuts | commits `61371e0`…`5e6014c` |
| البيانات الحية | ✅ وكيل `local-live` online ببيانات حقيقية | WORK_LOG §5 |
| الاختبارات | ✅ 15 unit + 10 control_plane | `python -m unittest` |
| Installer | ❌ Inno Setup غير مثبت — `release/` جاهز لكن لا Setup exe | WORK_LOG §9 |
| البيانات الوهمية | ✅ مُسحت (مرحلة 1) | commit `d84b7cd` |

---

## 4. خارطة الطريق — وين أنت بالضبط

> مرجع التنفيذ المفصّل: `C:\Users\AbdulghaniAli\.devin\plans\plan-d6156b03eaac8513.md`

### ✅ المرحلة 0 — الهوية الرسمية ASAAS (مكتملة)
- [x] مزامنة `skills/frontend/asaas-ui` مع GitHub = HEAD
- [x] استبدال `zimam-ui` → `asaas-ui` الرسمي + نقل `Table.tsx` + امتدادات API
- [x] عكس zimam→asaas في **كل** المشروع: frontend(51 ملف), `asaas_control`, `Asaas.Agent`, `AsaasLauncher`, `asaas.iss`, CI, tests, docs
- [x] `asaas_v2.db` + ترحيل تلقائي من `zimam_v2.db`
- [x] theme-init رسمي (فاتح افتراضي) + design-tokens مستعادة
- [x] **0.6+0.7 تم (2026-11-18):** viewport-matrix + mobile-responsiveness خضراء (13/13)؛ 72 لقطة في `docs/visual-audit-screenshots/matrix/`

### ✅ المرحلة 1 — البيانات الوهمية (مكتملة)
- [x] `score||95`, Docker version, threat `LOW`, `SRV-LOCAL`, JIT `ACTIVE`,
      disk `Healthy/GPT/NTFS`, `1Gbps`, freePercent `50` → كلها `—`/UNKNOWN

### 🔄 المرحلة 2 — التحصينات الأمنية (جارية)
- [x] Rate limiting `/api/v1/auth/login` — **موجود أصلاً** (8 محاولات/5د)
- [x] docker-compose — **محذوف** من المشروع أصلاً
- [x] `net user` password → NetUserAdd/NetUserSetInfo (موجود)
- [x] **password complexity ≥8 + 3/4 فئات** — `backend/app/services/user_service.py::_password_policy_error` (len≥8 + 3/4 من lower/upper/digit/symbol)
- [x] README/TESTS تحديث نهائي — README سليم (هوية ASAAS + /api/v1)؛ TESTS.md أُضيف له صفّا control_plane + Playwright e2e

### ✅ المرحلة 3 — استقرار التشغيل
- [x] `scripts/restart-elevated.ps1` — موجود ومُستخدم
- [x] Playwright e2e في CI — job `e2e-smoke` في `.github/workflows/ci.yml`
- [x] حذف `stitch_*.zip` — لا ملفات متعقبة (`git ls-files` نظيف)

### ⬜ المرحلة 4 — الترحيل لـ /api/v1 (أكبر شغل متبقٍ)
حسب `docs/MIGRATION_PLAN.md` — الترتيب:
1. auth ✅ (منجزة — login يفضّل v1 + bridge)
2. assets/accounts/policies → tokens → sessions → governor/telemetry
3. كل شريحة: endpoint حي + صفحة محوّلة + حذف legacy بنفس الـ commit
4. 🔄 agent write channel: `service.control` + `process.kill` + `task.control` + `hyperv.power` + `share.control` + `feature.toggle` + `firewall.rule` (+ `firewall.rules` collector) + `docker.container` (+ `docker.containers` collector) + `cert.remove` (+ `cert.list` collector) + `disk.state` (+ `disk.physical` collector) + `hotfix.install` + `startup.program.remove` + `local.user` + `software.uninstall` + share create UI ✅ end-to-end؛ Phase 4 agent write/collect domains complete

### ⬜ المرحلة 5 — بوابات الإصدار (Release Gates)
موثقة 501/503 في `CONTROL_PLANE.md` — **لازم تكتمل قبل البيع**:
- ~~SSH/SFTP proxy data path~~ ✅ SSH عبر guacd gateway؛ SFTP عبر `asaas_control/sftp.py` (paramiko sessions + `/api/v1/sftp/*` — list/stat/download/upload/mkdir/rename/delete)
- ~~Redis-backed token consumption (multi-worker)~~ ✅ `ASAAS_REDIS_URL` → atomic `SET NX EX` في `ConnectionTokenStore`؛ fallback ذاكرة للـ single-worker
- ~~live session terminate~~ ✅ (signed `session.logoff`/`session.disconnect` agent jobs via `/api/v1/sessions/*`)
- ~~screen/terminal recording + replay~~ ✅ `asaas_control/recording.py` — guacd instruction stream → `data/recordings/*.jsonl` + replay WebSocket؛ `ASAAS_GW_RECORD`
- ~~AD/LDAP sync~~ ✅ `asaas_control/directory.py` — ldap3 connector + `directory_users` read model + `POST /directory/sync` + `GET /directory/users`
- ~~off-box backup replication~~ ✅ `asaas_control/replication.py` — `ASAAS_BACKUP_DEST` file/sftp/s3 + auto-replicate on `/system/backup` + status endpoint
- ~~production mTLS issuance~~ ✅ `asaas_control/mtls.py` — CA محلي ECDSA + `POST /pki/ca` + `POST /agents/{id}/cert` + `GET /pki/ca.crt`؛ إنفاذ client-cert على TLS terminator خطوة نشر

### ⬜ المرحلة 6 — نواقص تشغيلية (من WORK_LOG)
- [ ] Shadowing: تحقق نهائي (RemoteFX fix مطبّق) + preflight validation
- [x] Agent كخدمة Windows — `Asaas.Agent.exe install|uninstall|status` موجود (sc.exe + env vars في registry + `AddWindowsService`)؛ تحقق تشغيلي على جهاز نظيف متبقٍ
- [x] Inno Setup install + بناء `ASAAS-Setup` — ISCC 6.7.3 موجود محلياً (`%LOCALAPPDATA%\Programs\Inno Setup 6`)؛ `installer-out\ASAAS-Setup-1.0.0.exe` (75.7MB) بُني بنجاح 2026-11-18؛ اختبار على VM نظيف متبقٍ
- [x] إعادة بناء `release/` — `tools/build-release.ps1` نجح (2026-11-18): `asaas-backend.exe` 14.3MB + `asaas-control.exe` 42.3MB (PyInstaller 6.22.3) + `Asaas.Agent.exe` 36.7MB (dotnet publish self-contained) + `web/` — عبر junctions لـ `.venv`/`node_modules` المستودع الرئيسي وSDK المحلي

---

## 5. Definition of Done (لو-product)

- [ ] كل الصفحات على `/api/v1` (legacy فقط للـ local console tools)
- [ ] كل الـ release gates في المرحلة 5 مغلقة
- [ ] `ASAAS-Setup.exe` مبني ومُختبر على VM نظيف
- [ ] Agent يعمل كخدمة Windows وينجو من إعادة التشغيل
- [ ] CI أخضر: unit + e2e + build + installer
- [ ] صفر أرقام وهمية / أزرار ميتة / mock handlers (anti-mock-audit)

---

## 6. أنت هنا الآن

```
[===========>            ] ~35%
Phase 0 ✅ | Phase 1 ✅ | Phase 2 🔄 | 3 ⬜ | 4 ⬜ | 5 ⬜ | 6 ⬜
```

**أقرب خطوة منطقية:** إنهاء المرحلة 2 (دقائق) → المرحلة 3 → ثم المرحلة 4 هي الشغل الكبير الحقيقي.
الخطة التنفيذية التفصيلية: `~/.devin/plans/plan-d6156b03eaac8513.md`
سجل العمل: `docs/WORK_LOG.md`
خطة الترحيل: `docs/MIGRATION_PLAN.md`
بوابات الإصدار: `CONTROL_PLANE.md`
```

---

### ملاحظة عن المنهج

الشغل السابق كان "عشوائي" لأن كل جلسة أعطت أولوية مختلفة. القاعدة من الآن:
**اختر دائماً أول بند ⬜ في أعلى مرحلة لم تكتمل** — المرحلة 2 الآن، ثم 3، ثم 4 بالترتيب المكتوب في MIGRATION_PLAN.
```

---

## 7. قرارات معمارية مهمة (لا تُعكس)

| القرار | السبب |
|---|---|
| بدون Docker | طلب صريح — بناء أصلي Windows |
| backend+control_plane على loopback فقط | لا شيء مكشوف على الشبكة؛ الـ proxy هو الواجهة |
| legacy `/api/*` يبقى للـ console المحلي | ~100 endpoints شغالة — الترحيل تدريجي لا big-bang |
| v1 هو المرجع للهوية | users في control-plane DB هو السلطة؛ legacy يُزامَن |
| agent jobs موقّعة Ed25519 read-only | الـ allowlist يمنع أي job كتابة عدا `session.logoff` الموقّع |
| البيانات الحية فقط | لا أرقام وهمية — `—`/empty state عند الفشل |
| الهوية = `AI-ASAAS/skills` الرسمي | لا نسخ معدّلة — أي انحراف يوثَّق في SKILL.md |

---

## 8. Risks / نقاط حساسة

- **النسخة الشغالة على :8765/:8876 قديمة (ZIMAM)** — لازم restart قبل أي اختبار UI جديد
- `enterprise_v25/v30` tests تحتاج `admin@asaas2026` + خادم شغال — تتخطى في CI العادي
- `graphify-out/` و`build-py/` مجلدات محلية غير متتبعة — تُحذف عند التنظيف
- Inno Setup غير مثبت على الجهاز — blocker وحيد للـ installer
- `release/` binaries لسا بأسماء zimam — تُعاد بناؤها في build-release.ps1
- Swarm skill مُثبّتة في `.venv` لكن تحتاج `OPENAI_API_KEY` للاستخدام الفعلي
```

*حدّث هذا الملف في نهاية كل مرحلة.*
```

---

## 9. سريعة — الأوامر

```bash
# بناء الواجهة
npm --prefix frontend run build

# اختبارات
.venv/Scripts/python.exe -m unittest discover -s tests          # unit
cd control_plane && ../.venv/Scripts/python.exe -m unittest discover -s tests

# تشغيل dev
run_asaas.ps1            # backend :8765
python control_plane/serve.py   # control plane :8876

# release
powershell tools/build-release.ps1   # binaries → release/
# ثم Inno Setup: ISCC.exe packaging\asaas.iss
```

---

## 10. مرجع الملفات

| الملف | المحتوى |
|---|---|
| `docs/PROJECT_MAP.md` | **هذا الملف — الخريطة الكاملة** |
| `docs/WORK_LOG.md` | سجل كل جلسة عمل بالتفصيل |
| `docs/MIGRATION_PLAN.md` | خطة ترحيل legacy → v1endpoint-by-endpoint |
| `CONTROL_PLANE.md` | معمارية v1 + release gates الموثقة 501/503 |
| `TESTS.md` | دليل الاختبارات |
| `skills/frontend/asaas-ui/` | مصدر هوية الواجهة الرسمي (نسخة GitHub) |
| `~/.devin/plans/plan-d6156b03eaac8513.md` | خطة المراحل 0–6 التنفيذية |
| `~/.agents/skills/` | كل الـ skills المسجلة (شاملة swarm) |
```

---

## ملخص تنفيذي (30 ثانية)

**المنتج:** لوحة تحكم سيرفرات Windows — frontend + control plane + agents + installer.
**خلص:** الهوية الرسمية ASAAS، الأمان الأساسي، بيانات حقيقية، البنية كاملة شغالة محلياً.
**الباقي بالترتيب:** إنهاء تحصينات (صغيرة) → استقرار تشغيل → **ترحيل v1 (الشغل الكبير)** → بوابات الإصدار → installer.
**أنت هنا:** نهاية المرحلة 1 — ~35% من الطريق لمنتج قابل للبيع.
```

*آخر تحديث: 2026-11-17 — 0+1 *
```

---

## 9. git commits

| Commit | Description |
|---|---|
| `9b0fc3c`–`a318bd8` | Previous sessions: cleanup, loopback security, kit identity, UI fixes |
| `feat(ui): restore official ASAAS identity` | Phase 0: official kit + strings |
| `refactor: rename ZIMAM→ASAAS` | Phase 0: backend/agent/launcher/packaging |
| `docs: log ASAAS identity restoration` | WORK_LOG update |
| `fix(ui): fabricated fallbacks` | Phase 1: fake-data removal |
| (next) | `docs: PROJECT_MAP.md` — this map |

---

*Rule from now on: always work on the first ⬜ item in the highest incomplete phase — 0→6 in order.*

---

## 10. NEXT SESSION HANDOFF (2026-11-17)

### Done since map was written
- P2 password complexity ✅ (`backend/app/services/user_service.py::_validate_windows_password_policy`, tests in `tests/test_security_primitives.py`)
- P3 `scripts/restart-elevated.ps1` ✅ (e2e CI was already present)
- P4 sessions slice ✅: `/api/v1/sessions` (agent `session.list` aggregation), `/sessions/terminate` + `/sessions/disconnect` (signed jobs, 202), `session.disconnect` in `agent/Program.cs` (`SessionProbe.Disconnect`, WTSDisconnectSession P/Invoke), ControlPage fleet rows actionable
- P6 shadow preflight ✅ (`backend/app/api/router.py` `/api/sessions/shadow` validates Active/non-self session)
- InfrastructurePage fleet migration ✅ (2026-11-18): 4 tabs → fleet collectors, `service.list` upgraded to `Get-Service`, `session.disconnect` added to agent allowlist
- Firewall rules slice ✅ (2026-11-18): `firewall.rules` collector + `firewall.rule` write job (`add|remove|enable|disable` via New-NetFirewallRule/Get-NetFirewallRule) — SecurityPage agent cards: rules list + toggle/delete + add-rule form → `apiV1.createJob`; `firewall.rules` added to AgentsPage collectors
- Docker ops slice ✅ (2026-11-18): `docker.containers` collector (`docker ps -a --format '{{json .}}'`) + `docker.container` write job (`start|stop|restart|pause|unpause` + `docker inspect` confirm) — ContainersPage docker tab fleet cards with per-state action buttons → `apiV1.createJob`
- Cert ops slice (2026-11-18): `cert.list` collector (LocalMachine cert store, 200 cap) + `cert.remove` write job (thumbprint hex 40|64 + store whitelist) — InfrastructurePage certs tab fleet cards with expired badges + delete

### Established pattern for remaining Phase 4 domains
1. Agent already implements collectors in `agent/Program.cs` dispatch (line ~287-315): service.list, disk.list, network.info, eventlog.tail, software.list, firewall.state, windows.features, scheduled.tasks, local.users, shares.list, hotfix.list, ports.list, startup.programs, hyperv.vms
2. Read model: `GET /api/v1/agents/{id}/results/latest` (latest succeeded result per job_type) and `GET /api/v1/fleet/summary` — `_latest_results_map(db, agent_id)` in `control_plane/asaas_control/api.py:1088`
3. Frontend pattern: `apiV1.agentLatestResults(id)` + heuristic row extraction (see `ControlPage.tsx` `sessionRows`/`procRows`, `fleetSessions` state ~line 130-148). `InfrastructurePage.tsx` adds `asItemArray()` — wraps bare-object single-row `PsProbe` payloads (scheduled.tasks/hotfix.list/ports.list return an object, not array, when there's exactly one row).
4. Job dispatch for UI-triggered actions: `POST /api/v1/jobs` (JobCreateRequest, allowlist `ALLOWED_JOB_TYPES` api.py:123)

### Next concrete steps (in order)
1. ~~Verify agent compiles~~ ✅ DONE — user-local SDK 10.0.402 at `%LOCALAPPDATA%\Microsoft\dotnet\dotnet.exe` builds `agent/` clean (0 warnings). NOTE: system `C:\Program Files\dotnet` has runtime only, no SDK.
2. ~~Migrate `InfrastructurePage` tabs to fleet collectors~~ ✅ DONE (2026-11-18): roles→`windows.features`, services→`service.list`, tasks→`scheduled.tasks`, updates→`hotfix.list` — aggregated fleet tables with agent column + honest per-agent empty states; certs tab stays legacy (no collector). Also: `service.list` collector upgraded from `sc.exe` (name-only) to `Get-Service` `{name,display_name,status,start_type}` — requires agent rebuild/redeploy; fixed missing `session.disconnect` in agent `AllowedJobs`. Write actions (service control, role install) removed — no agent write job types exist.
3. ~~Migrate `SecurityPage` firewall state → `firewall.state` collector.~~ ✅ DONE (2026-11-18, b412e2a): structured per-agent profile rows; rest of page stays legacy.
4. ~~`NetworkStoragePage` disks → `disk.list`; ports → `ports.list`.~~ ✅ DONE (2026-11-18): volumes tab → fleet `disk.list` aggregated table; `ports.list` already on `PortsPage`. Physical disks tab migrated to fleet `disk.physical` + `disk.state` write jobs (local server table kept below).
5. Remaining P5 release gates: SSH/SFTP data path, Redis token consumption, recordings, AD/LDAP sync, backup replication, mTLS (see CONTROL_PLANE.md 501/503 list).
6. P6 remainder: Inno Setup build (`packaging/asaas.iss` via ISCC), agent-as-service install test, clean VM install test.

### Known issues
- ~~agent C# unverified~~ resolved above
- enterprise_v25/v30 tests fail: need live server + `admin@asaas2026` (stale fixture vs live DB password).
- `frontend/ui-audit.mjs` unused `vh`; `AssetsPage.tsx` unnecessary `?? {}` — oxlint warnings.
- Login throttle `_login_attempts` is in-memory per-process (fine for single worker).
