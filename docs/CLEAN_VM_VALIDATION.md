# ASAAS — Clean VM Validation Runbook (Phase 6 Gate)

Goal: prove `ASAAS-Setup.exe` installs, auto-starts, survives reboot, and the agent enrolls/executes jobs — on a **fresh Windows 10/11 or Server 2022/25 VM with nothing else installed**.

Prereqs: the VM has internet optional (not required), Hyper-V/VMware/VirtualBox, ≥4 GB RAM, ≥40 GB disk. Copy `installer-out\ASAAS-Setup-1.0.0.exe` and `scripts\validate-clean-vm.ps1` to the VM (share/ISO/USB).

## Step 1 — Install

1. Right-click `ASAAS-Setup-1.0.0.exe` → Run as administrator.
2. Accept defaults (installs to `C:\Program Files\ASAAS`).
3. Untick "Launch ASAAS after installation" if you want a quiet first pass — either is fine.
4. **PASS**: wizard completes without errors.

## Step 2 — Automated checks (before reboot)

Elevated PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\validate-clean-vm.ps1
```

**PASS**: `ALL CHECKS PASSED` (exit 0). If anything fails, the script prints the exact fix hint — common causes: installer `[Run]` postinstall was skipped (re-run `C:\Program Files\ASAAS\scripts\install-tasks.ps1` elevated), or antivirus blocked the exes.

## Step 3 — Reboot persistence

1. `Restart-Computer` (or Start → Power → Restart).
2. After login, wait ~60 s for the AtStartup tasks + watchdogs.
3. Re-run `validate-clean-vm.ps1`.

**PASS**: same all-green result without manually starting anything. This proves the scheduled-task auto-start and watchdog restart work.

## Step 4 — First-run wizard & login

1. Browse `http://127.0.0.1:8876/`.
2. Complete the wizard: admin account (12+ char password), license key or 30-day trial.
3. Sign in → dashboard loads.

**PASS**: dashboard renders with real (empty-state) data — no fabricated metrics.

## Step 5 — Agent enrollment & signed job (the critical end-to-end proof)

On the **same VM** (agent and console co-located is fine for validation):

1. Console → **Agents** → create enrollment token.
2. Elevated prompt in `C:\Program Files\ASAAS\bin`:

```powershell
$env:ASAAS_CONTROL_PLANE_URL = "http://127.0.0.1:8876"
$env:ASAAS_AGENT_ID = "<id-from-console>"
$env:ASAAS_AGENT_KEY = "<key-from-console>"
.\Asaas.Agent.exe install
.\Asaas.Agent.exe status
```

**PASS**: `status` shows the `ASAAS Windows Agent` service running. Within ~30 s the agent appears **online** in the console.

3. Console → Agents → **قياسات** (collect all) or send `system.info` job.
4. After ~15–30 s open **نتائج**.

**PASS**: `system.info` returns real hostname/OS data from the VM. This proves the signed-job channel end-to-end.

5. Reboot once more → agent service auto-starts (`sc.exe query "ASAAS Windows Agent"` = RUNNING) and the agent returns online without re-enrollment.

## Step 6 — Optional deeper checks

- **mTLS**: `POST /api/v1/pki/ca` then `POST /api/v1/agents/{id}/cert` — agent cert issued.
- **SFTP**: attach an account to an asset, browse via `/api/v1/sftp/*`.
- **Recording**: enable `ASAAS_GW_RECORD`, open a session, replay from `/replay`.
- **Uninstall**: run `Uninstall ASAAS` — verify tasks removed (`Get-ScheduledTask -TaskName 'ASAAS*'`) and `C:\Program Files\ASAAS` gone.

## Sign-off checklist

- [ ] Step 2 all PASS
- [ ] Step 3 all PASS after reboot
- [ ] Step 4 wizard + login OK
- [ ] Step 5 agent online + `system.info` real result + survives reboot
- [ ] (Optional) Step 6 spot checks

Record the VM image name, Windows build (`winver`), and date in `docs/WORK_LOG.md` when signing off.
