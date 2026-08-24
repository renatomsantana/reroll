# AGENT SPEC — PDF Character Sheet Import Pipeline (Beta)

> **Instructions for the coding agent:** This document specifies the PDF import feature of the Pocket Dice Roller app in full detail. It complements `AGENT_SPEC_pocket-dice-roller.md` (read that first — especially Sections 3, 5, and 8). Everything here runs **100% offline**, inside the existing Electron app. Build it as an isolated, testable module.

---

## 1. Goal

The user uploads the PDF character sheet of whatever RPG they are playing. The app reads it and produces a complete, ready-to-play **Character Profile**: identity, attributes, skills, roll presets for attacks/moves/spells, inventory, and backstory. After a mandatory user review step, the profile is saved and the app "molds itself" to that character.

**Definition of success:** for ANY sheet from ANY system, the user ends up with a correct profile. Automation gets them 80–100% of the way; the Review & Fix screen guarantees the final 100%. Never block profile creation because parsing failed — degrade gracefully to manual entry with whatever was extracted.

---

## 2. Architecture Overview

```
PDF file
  │
  ▼
[Stage 0] Validation & sandboxing
  │
  ▼
[Stage 1] Extraction (3 strategies, in order)
  │   1a. AcroForm fields  → structured key/value pairs
  │   1b. Text layer       → positioned text runs
  │   1c. OCR fallback     → positioned text from page images
  │
  ▼
[Stage 2] System identification
  │   templates (D&D 5e, PF2e, CoC 7e, Kids on Bikes, …) → generic mode
  │
  ▼
[Stage 3] Field mapping → CandidateProfile (every field has a confidence score)
  │
  ▼
[Stage 4] Preset generation (attacks/spells/skills → roll formulas)
  │
  ▼
[Stage 5] Review & Fix screen (user confirms/edits everything)
  │
  ▼
Saved Character Profile
```

Each stage is a pure module with its own unit tests. Stages 1–4 run in a worker/utility process (see Section 8). The UI only ever consumes the `CandidateProfile` JSON.

---

## 3. Stage 0 — Validation & Sandboxing

- Accept only `.pdf`; verify the `%PDF-` magic bytes, not just the extension.
- Enforce limits: max file size 50 MB, max 100 pages. Reject beyond limits with a clear message.
- Copy the file into a temp working dir; never operate on the user's original.
- The parsing process has **no network access and no Node integration**; it receives the file path + returns JSON only (see Section 8).
- Ignore all embedded JavaScript, embedded files, and launch actions in the PDF. Never execute anything from the document.
- Malformed/corrupt PDF → catch, log locally (no user data in logs), and route the user to manual profile creation with a friendly message. The app must never crash on any input.

## 4. Stage 1 — Extraction Strategies

Run in order; each strategy records what it found and its coverage. If a strategy yields insufficient text (< threshold of characters per page), fall through to the next.

### 1a. AcroForm / XFA form fields (best case)
- Many official sheets (e.g., WotC's fillable D&D 5e sheet) are fillable PDFs. Extract every field name + value (text fields, checkboxes, radio groups).
- Field names on official sheets are stable identifiers (e.g., `STR`, `HPMax`, `Wpn Name`) — templates (Stage 2) map them directly. This path gives near-perfect data.

### 1b. Text layer extraction
- For flat-but-digital PDFs: extract text **with positions** (x, y, page, font size). Position matters — sheets are 2D layouts, and "label left/above value" is the core heuristic.
- Normalize: unicode NFC, collapse whitespace, keep reading order per column.
- Recommended lib: `pdf.js` (Mozilla) — pure JS, runs offline, battle-tested. Do not shell out to external binaries.

### 1c. OCR fallback (scanned/photographed sheets)
- Render pages to images (via pdf.js canvas), then OCR with **Tesseract (tesseract.js or bundled native tesseract)** — fully offline, language packs bundled in the installer (at minimum `eng` + `por`).
- Preprocess images: grayscale, contrast normalization, deskew. Skewed phone photos of sheets are a primary real-world case.
- OCR output also carries positions (word bounding boxes) so the same 2D mapping logic applies.
- OCR results always get lower confidence scores; expect the Review screen to do more work here. That is acceptable.
- If OCR is unavailable on the machine or fails, skip to manual entry with a clear message — never crash.

## 5. Stage 2 — System Identification

- Compute a fingerprint of the sheet: distinctive keywords/labels and their layout (e.g., "Charisma", "Spell Save DC" → D&D 5e; "Sanity", "Luck" → CoC; "Brains", "Brawn", "Grit" → Kids on Bikes), plus form-field names when present.
- Match against **template files** stored in a `templates/` folder shipped with the app. Each template is a JSON/YAML file — NOT hardcoded — declaring:
  - `system`: name + version (e.g., `dnd5e`),
  - `detect`: keywords/field names + minimum match score,
  - `fields`: mapping rules from field names or label patterns → profile fields,
  - `derived`: computed values (e.g., 5e ability modifier = floor((score−10)/2)),
  - `presets`: rules for turning weapons/spells/skills rows into roll formulas,
  - `dice`: the system's core mechanic (e.g., `d20 + mod vs DC`, `d100 roll-under`, Kids on Bikes' die-per-stat).
- Ship templates for at least: **D&D 5e, Pathfinder 2e, Call of Cthulhu 7e, Kids on Bikes**. The folder is pluggable — new templates can arrive via app updates (or user-added files) without code changes.
- No template reaches its match threshold → **generic mode** (Stage 3 heuristics only), clearly telling the user "System not recognized — I extracted what I could, please review."

## 6. Stage 3 — Field Mapping → CandidateProfile

Target schema (all fields optional; every value carries `{ value, confidence: 0–1, source: "form" | "text" | "ocr" | "user" }`):

```json
{
  "identity":  { "name": "", "system": "", "class": "", "level": "", "ancestry": "", "player": "" },
  "attributes": [ { "key": "STR", "label": "Strength", "value": 16, "modifier": 3 } ],
  "skills":     [ { "label": "Persuasion", "modifier": 7 } ],
  "resources":  [ { "label": "HP", "current": 27, "max": 27 } ],
  "presets":    [ ],
  "inventory":  [ { "name": "Lute", "qty": 1, "notes": "" } ],
  "backstory":  ""
}
```

- **Template mode:** apply the template's mapping rules; compute derived values; validate ranges (e.g., 5e ability 1–30) — out-of-range → lower confidence, flag for review.
- **Generic mode heuristics:** label:value pairs ("Strength: 16"), label-adjacent numbers using positions, list detection for inventory (bullet/line runs of short items), and the longest free-text block(s) → backstory candidate.
- Numbers rule: prefer integers near labels; treat `+3` / `-1` as modifiers; treat `12/15` as current/max.
- Nothing confidently found for a field → leave it empty. **Never invent values.** Empty + flagged is correct; hallucinated is a bug.

## 7. Stage 4 — Preset Generation (Roll Formulas)

- Define one internal **roll formula grammar** used everywhere in the app (rolling screen, presets, editor):
  - `NdX`, arithmetic (`+ - * ( )`), modifiers by reference (`@STR.mod`, `@prof`),
  - keep/drop: `kh1`, `kl1`, `dh1`, `dl1` (advantage = `2d20kh1`),
  - exploding `!`, rerolls `r<2`, target numbers `>=15`, success counting `#>=6`.
- Template `presets` rules convert sheet rows into presets. Examples:
  - 5e weapon row (name, atk bonus, damage) → two-part preset: **to-hit** `1d20 + {atk}` and **damage** `{dmg}` — one button, two labeled results.
  - 5e spell with save → preset showing save DC + damage roll.
  - CoC skill → `1d100` roll-under vs skill value, reporting success/hard/extreme.
  - Kids on Bikes stat → roll that stat's die (per the sheet's die assignment), with the system's explosion rule.
- Every generated preset is editable; users can also create presets from scratch with the same grammar (this editor is a hard requirement — it is the universal escape hatch for any system).
- Unit-test the grammar parser exhaustively (valid, invalid, edge cases). It is the heart of the app.

## 8. Process Isolation & Security

- Run Stages 1–4 in an **Electron `utilityProcess`** (or sandboxed hidden renderer) with: no `nodeIntegration` beyond what parsing libs need, **network access blocked** (the app's global request whitelist — GitHub-only — already enforces this; verify it applies to this process too), and a **hard timeout** (e.g., 60 s) after which the process is killed and the user is routed to manual entry.
- Communication: main process sends `{ filePath }`, worker returns `{ candidateProfile }` or `{ error }` as JSON. No other IPC surface.
- Bundle all parsing/OCR assets (pdf.js, tesseract wasm/binaries, language data) inside the installer. **Zero downloads at runtime.**
- Delete temp files (page images, working copy) after import, success or failure.
- Add adversarial tests: corrupt PDFs, zip-bomb-style PDFs, PDFs with embedded JS, 0-byte files, huge files, non-PDF renamed to .pdf. Expected result in every case: graceful error, no crash, no hang.

## 9. Stage 5 — Review & Fix Screen (non-negotiable)

- After every import, show everything extracted, grouped (Identity / Attributes / Skills / Presets / Inventory / Backstory).
- **Low-confidence fields (< 0.7) are visually flagged** and listed first ("Please check these").
- Everything is editable inline: fix values, rename, add missing items, delete wrong ones, edit preset formulas (with live formula validation + a "test roll" button).
- Side-by-side view: show the original PDF page next to the fields (pdf.js render), so the user can compare without leaving the app.
- "Save Profile" creates the profile (marking user-edited fields `source: "user"`, confidence 1.0). "Discard" deletes all traces.
- Re-import into an existing profile: show a **diff** (old vs new values) and let the user choose per field. Never silently overwrite user edits.

## 9.1 Profile Integration — Import Creates a Full Profile Page (core flow)

Importing a PDF is not just data extraction — it is the app's **"New Character" flow**:

- **"Upload PDF" is available directly from the profile selector** as the primary way to add a character ("New Profile → From PDF" alongside "New Profile → Manual"). On save from the Review screen, a **new profile is created instantly** with its own character page and appears in the selector, already selectable — no extra setup steps.
- **The new profile's character page** shows everything from the sheet: identity header, attributes/stats, skills, resources (HP etc.), one-click roll presets, inventory, backstory — plus that profile's notes panel. This page IS the "app molded to the sheet."
- **Every profile owns its complete state, saved automatically:**
  - dice **designs** (colors/materials per die),
  - rolling **environment/board** choice,
  - **tower** on/off,
  - **roll history**,
  - roll **presets** (imported + manual),
  - session **notes**,
  - character data (attributes, inventory, backstory),
  - display preferences tied to that character.
- A newly imported profile starts with the default dice design; the user customizes it in the Design Studio and it is saved to that profile only.
- **Hot-swap applies fully:** the user can switch profiles at ANY moment; the outgoing profile's entire state above is autosaved before the incoming one loads, and switching back restores it exactly. No save buttons, no unsaved-changes dialogs, no data bleeding between profiles.
- Deleting a profile removes all of its state (with confirmation + backup, per the main spec); exporting a profile packages all of it into one file.

**Acceptance addition:** upload a PDF → confirm in Review → new profile appears in the selector → customize its dice + environment + tower, roll a few times, write a note → switch to another profile and back → everything (board, tower, designs, history, notes, presets) is exactly as left. Verified also after app restart.

## 10. Testing & Acceptance Criteria

**Test corpus** (kept in a local, git-ignored folder — official sheets are publisher copyright and must NOT be committed to the public repo; commit only self-made or freely-licensed sheets):
- Filled fillable 5e sheet (form path), flattened/printed 5e sheet (text path), phone-photo scan of a handwritten sheet (OCR path), Kids on Bikes sheet, CoC 7e sheet, a homebrew sheet from an unknown system, plus the adversarial files from Section 8.

**The feature is done when:**
1. The filled 5e fillable sheet imports with ≥ 95% of fields correct pre-review, including working attack presets.
2. The Kids on Bikes and CoC sheets import via their templates with correct system dice mechanics in the presets.
3. The unknown homebrew sheet produces a partial profile in generic mode, and the user can complete it entirely in the Review screen without touching a settings file.
4. The scanned/photo sheet goes through OCR and produces an editable candidate (accuracy may be lower — flagged fields are acceptable).
5. Every adversarial file is rejected gracefully; the worker never crashes the app and always respects the timeout.
6. Import runs fully offline (verified with a network monitor: zero requests during import).
7. All extracted data lands in the existing per-profile persistence (schema-versioned, atomic writes, hot-swap safe).

## 11. Build Order

1. Roll formula grammar + parser + tests (Section 7) — everything depends on it.
2. Stage 0 + worker-process skeleton with timeout + adversarial tests.
3. Stage 1a (forms) → 1b (text) → 1c (OCR), each with corpus tests.
4. Template format + D&D 5e template end-to-end.
5. Stage 3 generic heuristics.
6. Stage 4 preset generation for 5e; then CoC, Kids on Bikes, PF2e templates.
7. Review & Fix screen (with PDF side-by-side + formula editor).
8. Re-import diff flow, cleanup, full acceptance pass (Section 10).
