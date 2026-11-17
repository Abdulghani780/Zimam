# Privacy Policy — ASAAS

*Template pending legal review.*

## What the appliance stores (on your infrastructure)

- **Accounts**: usernames, Argon2 password hashes, roles, optional TOTP secrets (encrypted at rest in the local vault envelope)
- **Account secrets** (vault): AES-256-GCM encrypted; keys never leave the appliance
- **Audit log**: append-only hash-chained record of administrative actions
- **Agent data**: inventory snapshots, job results, heartbeats submitted by your agents
- **Backups**: local SQLite snapshots under `data/backups/`

All of the above stays on machines you control. The console is designed for **air-gapped / on-prem** operation.

## What ASAAS (the vendor) may receive — opt-in only

- **License activation/renewal**: if you use the license portal, the customer ID and tier are transmitted to issue your key. No telemetry is bundled.
- **Optional fleet telemetry** (when enabled in a future release): license-health pings only — version, tier, agent count. No hostnames, IPs, usernames, or job content.

## What we never do

- No advertising trackers, no analytics SDKs in the console
- No transmission of credentials, vault secrets, session recordings, or audit contents to the vendor
- No data sale or third-party sharing

## Your controls

- Disable telemetry entirely (it is off by default)
- Delete backups and the database to erase local data
- Agent keys can be rotated by re-enrolling

## Contact

*To be completed with your privacy contact.*
