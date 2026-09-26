# Recomposition — 12 weeks

Private dashboard for a 12-week training cycle tracked in Hevy and coached weekly by Claude.
The site is public on GitHub Pages; the data inside it is AES-encrypted and opens only
with a passphrase in the browser. See `CLAUDE.md` for architecture and the data contract.

## One-time setup

**1. Repository.** Create a public GitHub repo (free Pages requires public, which is why the
data is encrypted) and push this folder. Settings -> Pages -> Source: **GitHub Actions**.

**2. Secrets** (Settings -> Secrets and variables -> Actions -> Secrets):

| Secret | Value |
|---|---|
| `HEVY_API_KEY` | From hevy.com/settings?developer (Hevy PRO) |
| `DASHBOARD_PASSPHRASE` | 5+ random words. It is the only thing protecting the data: don't reuse a password |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON key of a Google service account (step 3) |

**3. Google service account** (read-only access to the coach's Drive files):
1. console.cloud.google.com -> new project -> enable **Google Drive API**.
2. IAM -> Service accounts -> create one -> Keys -> Add key -> JSON. Paste the whole file as the secret.
3. In Drive, share these with the service account's email as **Viewer**:
   the `Allenamento/Report settimanali` folder (reports and `dati/` inside it) and the
   `Piano — modifiche` doc. It sees nothing else.

**4. Variables** (same page -> Variables tab). IDs are the long part of the Drive URL:

| Variable | Points to |
|---|---|
| `DRIVE_REPORTS_FOLDER_ID` | `Allenamento/Report settimanali` |
| `DRIVE_DATA_FOLDER_ID` | `Allenamento/Report settimanali/dati` (after the coach creates it) |
| `DRIVE_OVERRIDES_DOC_ID` | `Piano — modifiche` |

**5. Coach skill.** Add `skill-addition/SKILL-dashboard-section.md` to the
`hevy-weekly-coach` skill so each Saturday run also writes `SXX.json`.

**6. Run it.** Actions -> "Build & deploy dashboard" -> Run workflow. It then runs by itself
every day at 09:00 Rome time. Trigger it by hand whenever you want fresher data.

## Changing the passphrase

Update the `DASHBOARD_PASSPHRASE` secret, generate a new salt in `scripts/lib/crypto.js`
(`node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"`), push. Devices
that chose "Remember on this device" will ask for the new passphrase.
