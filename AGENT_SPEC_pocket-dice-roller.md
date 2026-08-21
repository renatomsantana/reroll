# AGENT SPEC — Pocket Dice Roller for TTRPG Players (Windows Desktop App)

> **Instructions for the coding agent:** You are working on an existing, shipping application — read this entire document before writing any code. Do not skip the Security & Quality requirements — they apply to every line of code you write, in every phase.

## 0. CURRENT STATUS (read first)

- **Alpha is essentially complete and shipping at v1.0.9.** Dice rolling, dice designs, environments, dice tower, and session notes are already built. Sections 2.x below describe what exists — treat them as the reference for regressions, not as new work.
- **The app is built on Electron and is being migrated from Electron 33 → Electron 43.** Migration tasks are in Section 8 and take priority over new Beta features.
- **Next major milestone:** the Beta (Section 3 — PDF character sheet import + profiles). Before starting Beta work, complete Section 8.1 (data schema versioning) and Section 8.2 (security audit of the existing Alpha code) — they are prerequisites.

---

## 1. Product Vision

A "pocket dice roller" desktop app for people who play tabletop RPGs online (D&D, Kids on Bikes, Call of Cthulhu, Tormenta, etc.). The player keeps this small app open next to their video call / VTT and uses it to roll dice, manage character profiles, and take session notes.

Core promise: **the player opens the app and everything from their last session is exactly where they left it** — dice designs, character presets, notes, theme. Zero setup friction between sessions.

- **Platform:** Windows 10/11 desktop application.
- **Distribution:** a standard installer (e.g., NSIS via electron-builder, or MSIX). After install, the app appears as a normal desktop/Start Menu icon.
- **Updates:** auto-update via GitHub Releases. The app checks for updates on launch, and **always asks the user** "A new version is available. Update now?" — it never force-updates silently.
- **Recommended stack (agent may propose alternatives with justification):** Electron + TypeScript + React for UI, with a 3D dice-physics layer (e.g., Three.js + a physics engine like cannon-es/rapier) for realistic rolls. Local persistence via SQLite or JSON files in the user data folder. If the agent chooses Tauri or .NET instead, all requirements below still apply unchanged.

---

## 2. Phase 1 — ALPHA (Dice Roller Core)

### 2.1 Dice Types
Implement fully functional rollers for exactly these dice:

- **d4, d6, d8, d10, d12, d20, d100**
- (There is **no d50** — do not include it.)
- d100 may be rendered as two d10s (tens + units) or a single percentile die — pick one, but the result must be a clean 1–100.

Requirements:
- Roll a single die or a pool (e.g., 4d6, 2d20).
- Support modifiers (e.g., `1d20 + 5`).
- Support common roll modes: normal, advantage/disadvantage (roll twice, keep highest/lowest), keep-highest / keep-lowest / drop-lowest (e.g., 4d6 drop lowest), and exploding dice — these must be configurable per roll, because different RPG systems use different mechanics.
- Show a **roll history** panel (timestamped, per profile).
- Randomness must come from a cryptographically secure RNG (`crypto.getRandomValues` / equivalent), never `Math.random()`, and must be provably unbiased across the die's range.

### 2.2 Dice Design Studio
A dedicated screen where the user customizes the look of their dice:

- Choose **color** (body, numbers/pips, edges) **per individual die type** (e.g., red d20, blue d6).
- Or apply one design **to all dice at once** ("apply to all" toggle).
- Include material/finish options (e.g., solid, metallic, translucent) if feasible; at minimum, full color customization.
- Live 3D preview of the die being edited.
- Designs are saved **per character profile** (see Phase 2), so switching profiles switches dice designs automatically.

### 2.3 Rolling Environment
- The user chooses the **surface/platform** the dice roll on: e.g., wooden table, felt/velvet mat, stone, neon/dark mat. At least 4 distinct environments.
- The user chooses **how results are displayed**: 3D animated roll, quick-result mode (instant number, minimal animation), or both.

### 2.4 Dice Tower
- An optional **dice tower**: when enabled, dice are dropped through an animated tower onto the surface.
- When disabled, dice are thrown "by hand" (normal toss animation).
- The tower is a toggle in the rolling screen, remembered per profile.

### 2.5 App-wide UX Settings (Alpha scope)
- **Font selection** (a curated list of readable fonts, including at least one dyslexia-friendly option).
- **Day / Night theme** (light/dark), with an option to follow the Windows system theme.
- **Compact mode**: a minimal, always-on-top small window showing just the roll bar + last result, ideal for keeping next to a VTT or Discord call. One click switches between full and compact.
- All settings persist across restarts.

---

## 3. Phase 2 — BETA (Character Sheet Import & Profiles)

### 3.1 PDF Character Sheet Import ("scraping")
The user uploads the **PDF character sheet** of whatever RPG system they are currently playing. The app must:

1. **Parse the PDF** — both fillable-form PDFs (extract AcroForm field values) and flat/scanned PDFs (text extraction + OCR fallback, e.g., Tesseract, fully offline).
2. **Identify the RPG system** when possible (D&D 5e, Kids on Bikes, CoC, etc.) via heuristics/templates, and fall back to a **generic extraction mode** for unknown systems.
3. **Extract and save into a Character Profile:**
   - Name, class/archetype, level (or system equivalents),
   - **Attributes/stats** (whatever the system uses — STR/DEX/… or Brains/Brawn/… etc.),
   - **Skills and modifiers**,
   - **Attacks/moves/spells → automatically converted into roll presets** (e.g., "Vicious Mockery: 1d20+7 to hit, 2d4 psychic damage" becomes two one-click preset buttons),
   - **Inventory**,
   - **Backstory / bio text** into the profile page.
4. **Mold the app to the sheet:** after import, the rolling screen shows that character's presets and stats front-and-center, using the dice mechanics of that system (e.g., d20-based for D&D, the specific dice-per-stat mechanic for Kids on Bikes).

**Robustness requirement (critical):** the import must work for **any RPG sheet, any system, any roll mechanic**. Since no parser is literally perfect on arbitrary PDFs, achieve "works for everything" through this mandatory pipeline:
- Template-based extraction for popular systems (ship with templates for at least: D&D 5e, Pathfinder 2e, Call of Cthulhu 7e, Kids on Bikes; make templates a pluggable folder so more can be added via updates).
- Generic extractor for unknown systems (labels + values detection).
- **Review & Fix screen (non-negotiable):** after every import, show the user everything that was extracted, clearly flag low-confidence fields, and let them edit/add/remove anything (stats, presets, inventory items) before saving. Manual creation/editing of presets must always be available even with no PDF at all. This guarantees the end state is always 100% correct for any system, because the user confirms it.
- Custom roll-formula editor supporting arbitrary expressions (`XdY + Z`, keep/drop, advantage, exploding, target numbers, success counting) so any system's mechanic can be represented.

### 3.2 Character Profiles & Persistence (critical feature)
- The user can create **multiple profiles — support at least 10 saved profiles** (there is no hard technical reason to cap it, so treat 10 as the guaranteed minimum, not a limit). Example: a D&D bard for Saturday's table, a 10-year-old kid for Sunday's Kids on Bikes table, plus characters from other campaigns — all stored side by side.
- **Profile selector UI must scale to 10+ profiles:** show each profile with its character name, system, and a visual identifier (avatar/color from its dice design); switching is one click from anywhere in the app.
- The user can **switch between profiles at any time**, and can rename, duplicate, and delete profiles (delete requires confirmation and creates a backup first).
- **Everything is saved per profile and restored instantly on switch:**
- **Hot-swap guarantee:** switching profiles can happen at ANY moment — mid-session, with unsaved-looking notes open, right after editing a dice design — and nothing is ever lost. The outgoing profile's full state (notes text, design edits, preset changes, roll history, preferences) is autosaved automatically before the incoming profile loads. There is no "Save" button and no "you have unsaved changes" dialog anywhere in the app; persistence is always automatic and immediate. Switching back must restore the previous profile exactly as it was left.
  - Dice designs,
  - Roll presets (imported and manual),
  - Attributes, inventory, backstory,
  - Session notes,
  - Roll history,
  - Environment/tower/display preferences.
- All data is stored **locally** (SQLite or structured JSON in `%APPDATA%`), written atomically (temp file + rename) so a crash never corrupts saves. Autosave on every change — there must never be a "you forgot to save" scenario.
- Include profile **export/import** (single file) so users can back up or move characters.

### 3.3 Session Notes
- A notes panel per profile (rich text or Markdown).
- Autosaved continuously; restored on profile switch and app restart.

---

## 4. Auto-Update via GitHub
- Use GitHub Releases + electron-updater (or equivalent) over **HTTPS only**.
- On launch (and via a manual "Check for updates" button), check for a new release.
- If found, prompt: changelog + "Update now / Later". Never install without consent.
- **Verify release integrity:** validate the update package checksum/signature metadata before applying. Never execute unverified downloaded code.

---

## 5. Security & Quality Requirements (apply to ALL code, both phases)

Context: the installer will be distributed **without a Windows code-signing certificate** at first (SmartScreen will warn users). Because of that, the app itself must be demonstrably clean and hardened — reputation depends on it. Treat security as a release blocker.

1. **Zero known vulnerabilities at release:** run `npm audit` (or equivalent) and a static analyzer in CI; the build fails on any high/critical finding. Pin dependency versions; keep the dependency tree minimal — every dependency must be justified.
2. **Electron hardening (if Electron):** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, a strict Content-Security-Policy, no `remote` module, validate/whitelist all IPC channels, disable navigation to external origins, `shell.openExternal` only for vetted https URLs.
3. **PDF parsing is untrusted input:** parse PDFs in a sandboxed/isolated process with no network access; enforce file-size limits; handle malformed/malicious PDFs gracefully (never crash, never execute embedded content, ignore embedded JavaScript entirely).
4. **No telemetry, no data exfiltration:** the app makes **no network requests at all** except the GitHub update check. Document this clearly in the README (a privacy selling point and easy to verify).
5. **Local data safety:** store user data only under the user's own AppData; no elevated privileges required to run; installer requests per-user install by default.
6. **Code quality:** TypeScript strict mode, ESLint, unit tests for the roll engine (statistical fairness tests included), integration tests for PDF import against sample sheets of each supported system, and error boundaries so one failure never takes down the app.
7. **Reproducible builds & transparency:** publish source on GitHub, build via GitHub Actions from tagged commits, and publish SHA-256 checksums of every installer in the release notes — so anyone can verify their download matches the official build. This is the main trust mechanism while unsigned.
8. **Graceful degradation:** if OCR or 3D rendering isn't available on a machine, fall back (manual entry mode / quick-result mode) instead of crashing.

---

## 6. Deliverables & Acceptance Criteria

**Alpha is done when:**
- All 7 dice types roll correctly with pools, modifiers, and roll modes; results are statistically fair.
- Dice Design Studio works (per-die and apply-to-all), with live preview.
- Environments + dice tower toggle work.
- Font, day/night theme, and compact mode work and persist.
- A Windows installer builds via CI, installs per-user, creates a desktop icon, and the update prompt flow works end-to-end from a GitHub Release.

**Beta is done when:**
- Uploading a D&D 5e sheet and a Kids on Bikes sheet each produces a correct, ready-to-play profile (presets, stats, inventory, backstory) after the Review & Fix step.
- An unknown/homebrew sheet still produces a usable profile via generic extraction + manual editing.
- With **10 profiles created**, switching between any of them instantly restores that profile's dice designs, presets, notes, history, and preferences — verified after an app restart and after a simulated crash, with no cross-contamination between profiles.
- Security checklist in Section 5 passes in CI with zero high/critical findings.

**Repository must include:** README (features, install, privacy statement, checksum verification instructions), CONTRIBUTING, LICENSE, CI workflows (build, test, audit, release), sample character-sheet PDFs for testing, and a CHANGELOG.

---

## 7. Suggested Build Order for the Agent (updated for current status)

1. ~~Alpha core~~ — **done (v1.0.9)**.
2. Electron 33 → 43 migration (Section 8.3) + tooling updates.
3. Data schema versioning + migration/backup system (Section 8.1) — **prerequisite for Beta**.
4. Security audit of existing Alpha code (Section 8.2) — **prerequisite for Beta**.
5. Profiles + persistence-on-switch (extend existing save system).
6. PDF import pipeline (forms → text → OCR) + system templates + generic extractor.
7. Review & Fix screen + preset/formula editor.
8. Hardening pass, statistical tests, release checklist (Section 8.4).

---

## 8. Migration, Data Safety & Release Hygiene (NEW — high priority)

### 8.1 Save-Data Schema Versioning & Migrations (do this BEFORE Beta)
Users already have real data saved by v1.0.x (dice designs, notes, settings). The Beta will change the data structure (profiles, presets). Data loss on update is the single most trust-destroying bug possible for an app whose promise is "everything is saved." Therefore:

- Add a `schemaVersion` field to the persisted data (settings/saves file or DB).
- On startup, if `schemaVersion` < current, run **sequential migration functions** (v1 → v2 → v3 …) that convert old data to the new format. Never require the user to do anything.
- **Before running any migration, copy the entire user-data folder to a timestamped backup** (e.g., `%APPDATA%/<app>/backups/pre-migration-<version>-<date>/`). Keep the last 3 backups.
- Write automated tests that load a real v1.0.9 data snapshot and verify it migrates cleanly to the current schema.
- All writes remain atomic (write temp file → fsync → rename).

### 8.2 Security Audit of Existing Alpha Code (do this BEFORE Beta)
The Alpha grew across versions; before it starts parsing untrusted PDFs, audit and fix the existing codebase against Section 5. Checklist:

- [ ] `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on every window.
- [ ] All IPC channels whitelisted and input-validated; no generic "eval"-style channels.
- [ ] Strict CSP; no remote content loaded; navigation to external origins blocked.
- [ ] `shell.openExternal` only for hardcoded/vetted https URLs.
- [ ] **DevTools disabled in production builds.**
- [ ] No user data (notes, character info, file paths) written to log files.
- [ ] `npm audit` / static analysis clean at high/critical level; dependencies pinned and pruned.

### 8.3 Electron 33 → 43 Migration Tasks
- Review the official `breaking-changes.md` **for every major from 34 through 43** and check each entry against the codebase.
- Known item that affects this app directly: in Electron 43, `dialog.showOpenDialog`/`showSaveDialog` **default to the Downloads folder and the OS no longer restores the last-used directory.** For the Beta's PDF upload, track the last-used directory in app settings and pass it as `defaultPath`.
- Update `electron-builder` / `electron-updater` and any native modules to versions compatible with Electron 43's Node ABI; rebuild native deps.
- After migration, **test the auto-update path end-to-end**: install a packaged old build, publish a test release on GitHub, and verify prompt → download → checksum verification → install → data intact (schema migration runs, backup created).
- Ongoing policy: Electron supports only the latest three major series (43 reaches EOL January 2027). Plan to bump one major every ~2–4 months; staying on a supported Electron is part of the "zero vulnerabilities" requirement, since Chromium security patches only land on supported series.

### 8.4 Release & Distribution Trust (unsigned installer)
For every public release, in addition to Section 5.7 (open source, CI builds, SHA-256 checksums):

- **Upload the installer to VirusTotal and publish the scan-result link in the release notes**, next to the checksum. A clean multi-engine scan + matching hash is the strongest trust signal available without a code-signing certificate.
- Also publish a **portable build** (single .exe, no installer) and consider publishing to **winget** — both lower the trust barrier for cautious users.
- Choose and commit a **LICENSE** before promoting the repository (e.g., MIT for maximum permissiveness, GPL to prevent closed-source forks). Changing later, after external contributors exist, is legally messy.
- Investigate low-cost code signing early (e.g., Azure Trusted Signing has an individual tier around US$10/month — verify current pricing) rather than treating signing as a distant goal.

### 8.5 Beta Testing With Real Sheets
- Build the PDF-import test corpus from **real, filled-in character sheets from actual play** (the developer's own tables: e.g., a D&D 5e bard, a Kids on Bikes kid), not just blank official sheets. Real sheets are messy — handwriting notes, skewed scans, homebrew layouts — and are exactly what users will upload.
- Do not market the Beta as "reads any sheet" until it demonstrably handles the sheets of at least 2–3 real ongoing tables; the Review & Fix screen (Section 3.1) is what guarantees correctness for everything else.
