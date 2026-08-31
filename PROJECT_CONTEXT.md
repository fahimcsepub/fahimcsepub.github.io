# PUB CSE Automations — Project Context

Last updated: 31 August 2026

This file is the durable handoff for AI coding tools and future maintainers. Read it before changing the repository. User-facing operating instructions remain in the root and module READMEs; this document explains the intent, architecture, non-obvious decisions, and current implementation state.

## Project identity

- Product: **PUB Dept. CSE Automations** for the Department of Computer Science & Engineering at Pundra University.
- Repository: `fahimcsepub/fahimcsepub.github.io`
- Remote: `https://github.com/fahimcsepub/fahimcsepub.github.io.git`
- Public site: <https://fahimcsepub.github.io/>
- Deployment: static GitHub Pages; no backend, account, API key, or paid service.
- Privacy model: certificate records and signature images stay inside the user's browser.
- Current production module: Certificate Generator.
- Future direction: add independent departmental automation modules under `automations/<category>/<automation-name>/`; do not turn the certificate generator into an unrelated monolith.

## Repository map

```text
PUB-CSE-Automations/
├── AGENTS.md                     # Codex/agent startup instructions
├── CLAUDE.md                     # Claude startup instructions
├── PROJECT_CONTEXT.md            # this shared handoff
├── README.md                     # public repository overview
├── automations/
│   ├── README.md                 # automation catalog
│   └── certificates-awards/
│       └── certificate-generator/
│           ├── README.md         # complete user and CSV guide
│           ├── references/       # approved source PowerPoint templates
│           ├── samples/          # non-sensitive examples
│           └── app/              # deployed React application
├── docs/ADDING_AN_AUTOMATION.md
└── .github/workflows/deploy.yml
```

The Git repository root is `PUB-CSE-Automations`, not the current workspace's parent `Certificate Generation` folder.

## Current state

- Default branch: `main`.
- Latest completed feature: ready-made **Course Coordination Excellence Award** custom mapping.
- That change was merged through PR #2: <https://github.com/fahimcsepub/fahimcsepub.github.io/pull/2>.
- GitHub Pages deployment completed successfully after the merge.
- At the last verification, all **19 Vitest tests** passed and the Vite production build succeeded.
- The site is designed to work at the GitHub Pages root and under relative asset paths.
- **PUB Classic Blue** is the default certificate template. Modern Vintage remains available.

Always inspect `git status`, recent commits, and the current branch before starting; this status section is a handoff, not a replacement for repository inspection.

## Certificate Generator architecture

App directory:

```text
automations/certificates-awards/certificate-generator/app
```

Stack:

- Vite, React 19, TypeScript
- `pdf-lib` and `@pdf-lib/fontkit` for A4 landscape PDFs
- Papa Parse for robust UTF-8 CSV input
- JSZip for bulk downloads
- IndexedDB through `idb` for the local issuance register
- Zod and React Hook Form for validation/forms
- Web Worker for sequential bulk rendering
- Locally bundled Libre Baskerville, Source Sans 3, and Noto Serif Bengali fonts

Important source files:

- `src/App.tsx` — application navigation, settings persistence/migration, shared state.
- `src/types.ts` — canonical record, setting, custom-mapping, signature, and bulk types.
- `src/lib/certificate.ts` — defaults, award/category normalization, citation templates, validation, numbering, filenames.
- `src/lib/pdf.ts` — the shared preview/export PDF renderer and all certificate geometry.
- `src/lib/csv.ts` — CSV parsing, aliases, sample/error/register CSV, bulk numbering.
- `src/lib/register.ts` — IndexedDB issuance register, reprints, import/merge/conflict behavior.
- `src/components/GeneratePanel.tsx` — single-certificate workflow and category-specific inputs.
- `src/components/BulkPanel.tsx` — CSV editing, validation, progress, combined/ZIP outputs.
- `src/components/SettingsPanel.tsx` — signatures, template defaults, labels, and custom award builder.
- `src/workers/bulk.worker.ts` — memory-conscious bulk PDF generation.

Official visual assets in `public/assets/`:

- `pub_classic_border.png`
- `pub_classic_seal.png`
- `pub_cse_logo_blue.png`
- `modern_vintage_blank_background.png`
- `modern_vintage_seal.png`
- `cse_department_logo_charcoal_gold.png`

Approved source slides remain in the module's `references/` directory. When adjusting certificate geometry, compare against those sources and generated PDF samples; do not approximate the design from memory.

## Product and design decisions

### Visual output

- PDF size is A4 landscape: `841.89 × 595.28` PDF points.
- Preview and download use the same PDF rendering path so screen and export remain aligned.
- Keep certificate text sharp/vector-based wherever possible.
- Recipient name uses Libre Baskerville SemiBold, not a calligraphy font. Bengali names use Noto Serif Bengali fallback.
- Keep the department logo clear of the top border.
- Certificate number and issue date must remain correctly balanced at the upper left/right positions defined by the approved templates.
- Never print editor hints or placeholder strings.

### Templates and signatures

- Template IDs are `pub-classic` and `modern-vintage`.
- User-facing name is **PUB Classic Blue**. Old `PUST Classic Blue` and `pust-classic` values are accepted only as import compatibility aliases.
- Default template is PUB Classic Blue.
- Default signature method is wet signature with two clean lines.
- Default labels are `Head of the Department` and `Dean, Faculty of Science & Engineering`; do not hard-code personal names.
- Digital signatures may be uploaded only as authorized transparent images and are session-only.
- One-signature mode uses a centered, seal-free lower layout for both templates. This is deliberate: the seal previously overlapped text in the single-signature Modern Vintage layout.
- Two-signature layouts retain the approved seal and existing left/right alignment. Do not alter them incidentally while fixing one-signature mode.

### Award wording

Main title is always:

> Certificate of Excellence

The award category appears as the subtitle. Built-in categories are:

1. Academic Excellence Award
2. Research Excellence Award
3. Outstanding Achievement Award

Custom mappings behave like first-class categories and can define reusable fields, validation, aliases, and a citation template.

Academic Excellence supports three explicit ranking scopes:

- `semester` — preferred/default. Uses `studySemester` (for example, `4th Semester`) and represents selection among all students of that academic semester, regardless of HSC/Diploma batch numbering.
- `batch` — retained when an award is truly batch-specific.
- `custom` — uses a free-form `rankingGroup` for another approved cohort.

The interface deliberately uses **Semester**, not “Level.” The separate `semester` field in records means the result/numbering term (`Spring`, `Summer`, or `Fall`). Avoid conflating these two concepts.

Citation behavior is explicit:

- `citationMode=automatic` uses the recommended category wording.
- `citationMode=custom` requires and uses `customCitation`.
- A legacy row with a non-empty custom citation and no mode is treated as custom.

Tie-breaking rules and winner selection are outside this app. Approved recipients are determined before data entry; tie-break details must not be printed on certificates.

### Course Coordinator preset

The app ships this ready-made custom mapping:

- ID: `custom:course-coordination`
- Label: `Course Coordination Excellence Award`
- CSV aliases: `CCEA`, `Course Coordinator`
- Required field key: `coordination_period`
- Field label: `Coordination period`
- CSV column: `field_coordination_period`
- Example: `Spring 2025 – Summer 2026`
- Citation token: `{{COORDINATION_PERIOD}}`
- Recommended citation:

> For successfully completing the appointed term as Course Coordinator of the Department of Computer Science & Engineering during {{COORDINATION_PERIOD}}, in recognition of dedicated service, academic leadership, and valuable contributions to the department.

`App.tsx` uses a settings schema version and a one-time migration to add this preset for existing users. The migration detects the ID, exact label, or `Course Coordinator` alias to prevent duplicates. Once a migrated user intentionally removes it, it must stay removed; do not re-add the preset on every application start.

### Certificate numbering

Format:

```text
CSE/{TERM}-{YEAR}/{SERIAL}
```

Term tokens:

- Spring → `SPR`
- Summer → `SUM`
- Fall/Autumn → `FAL`

Examples: `CSE/SPR-2026/001`, `CSE/SUM-2026/002`.

There is one shared serial sequence for each result term/year across all award categories. Category abbreviations such as AE/RE/OA/CCEA are not included in certificate numbers. Allocate a number only after validation. Manual overrides must match the format and be unique. A reprint keeps its original number.

## Custom award mappings

Custom mapping UX should remain understandable to a non-technical departmental user:

- Clear labels, examples, and short helper text are more important than exposing implementation terminology.
- Each mapping has a category name, optional aliases, description, enabled state, fields, and a default citation template.
- Field types: text, textarea, number, date, select.
- Field keys are normalized and become CSV columns named `field_<key>`.
- Citation tokens use uppercase normalized keys, such as field `project_title` → `{{PROJECT_TITLE}}`.
- Mappings can be edited, disabled, removed, and reordered without breaking historical register records.
- Custom citation mode remains available per certificate and per CSV row even when a mapping has recommended wording.

When adding another official preset, implement its default, normalization/alias behavior, migration strategy, CSV sample/header behavior, validation tests, and documentation together.

## Bulk CSV and register rules

The complete current CSV header and examples live in the module README and are generated by `src/lib/csv.ts`. Treat the implementation as canonical and keep documentation/tests synchronized.

Key rules:

- UTF-8 with BOM for Excel compatibility.
- Accept quoted commas, multiline cells, and Bengali text.
- Export safely against spreadsheet formula injection.
- Up to 500 imported rows.
- Mixed award categories and templates in one CSV.
- Never silently discard an invalid row; keep it editable and offer an error CSV.
- Custom fields use `field_<key>` columns.
- Duplicate recipient names are allowed; duplicate certificate numbers are not.
- Register imports deduplicate identical records and block conflicting records with the same certificate number.
- Register reprints retain their original number and increment reprint count.
- Browser data can be lost if site data is cleared, so the UI should continue recommending register CSV backups.

## Privacy and repository hygiene

Never commit:

- Real student or faculty recipient lists
- Private bulk CSVs or issuance-register exports
- Real signature images
- Credentials, access tokens, API keys, or browser storage dumps
- Generated working PDFs containing personal data
- `node_modules`, build output, or temporary inspection artifacts unless an approved non-sensitive sample is intentionally maintained

Official template source files and curated non-sensitive samples are allowed only in their existing `references/` and `samples/` locations. Do not remove those approved references as “unnecessary” without confirming their role.

## Local development and verification

Use Node.js 22.13 or newer; Node.js 24 LTS is recommended.

PowerShell:

```powershell
Set-Location "automations/certificates-awards/certificate-generator/app"
npm install
npm run dev
```

The usual local URL is <http://127.0.0.1:5173/> or the URL printed by Vite.

Before committing a functional change:

```powershell
npm run test:run
npm run build
```

Also run `git diff --check`. For PDF/layout changes, visually inspect both templates and both one-/two-signature layouts, then generate a real PDF and check borders, logo clearance, number/date alignment, name/citation wrapping, seal placement, and absence of placeholders. For CSV changes, test manual generation plus mixed-category imports and sample CSV output.

Current automated test areas:

- Citation mapping and validation
- Academic ranking scopes and custom citations
- Certificate-number generation and uniqueness behavior
- Course Coordinator preset/migration helper
- CSV aliases, custom fields, Bengali/quoted content, and invalid rows
- PDF size/layout and placeholder safety

## Git and GitHub workflow

For meaningful changes:

1. Synchronize `main` and inspect the worktree.
2. Create a focused `feature/<name>` branch.
3. Make scoped changes without deleting unrelated user work.
4. Run tests, production build, and proportionate local/browser/PDF verification.
5. Commit and push the feature branch.
6. Open a PR against `main` with a concise summary and verification results.
7. Confirm the PR is mergeable, then merge when the user has authorized implementation and publication.
8. Pull the merged `main` locally.
9. Watch the **Deploy PUB CSE Automations** workflow and verify the public site after deployment.

For visually significant UI or certificate-template changes, the user's established preference is to show the local result first and merge after approval. Documentation-only or already-approved scoped changes can still use a normal reviewed PR.

GitHub Pages workflow:

- File: `.github/workflows/deploy.yml`
- Trigger: push to `main` or manual dispatch
- Runtime: Node 24
- Build directory: certificate generator app
- Steps: `npm ci`, tests, build, upload Pages artifact, deploy

The workflow currently deploys the certificate generator at the root site. When a multi-module portal is built, change the deployed app deliberately and preserve a route/navigation entry for the certificate generator.

## Change checklist

Before considering a change complete, ask:

- Does it preserve both templates and signature layouts?
- Are preview and exported PDF still using the same renderer?
- Are placeholder/editor hints excluded from exported PDFs?
- Are wording, validation, manual form, bulk CSV, register, and docs consistent?
- Does it work with Bengali names and long text within the approved fitting limits?
- Does it preserve local data migration and backward-compatible aliases?
- Does it introduce any sensitive data or runtime network dependency?
- Did tests and production build pass?
- If deployed, did the GitHub Pages workflow and public-site verification succeed?

## Maintaining this context

Update this file when any of the following changes:

- Repository/module architecture
- Official certificate wording, numbering, templates, or signature rules
- CSV schema or custom mapping behavior
- Persistence/migration behavior
- Build/test/deployment workflow
- Important user-approved design decision
- Current production module or live URL

Do not record transient chat details, secrets, personal data, or speculative plans as settled facts. Prefer links to canonical code and module documentation over copying large implementation details that will become stale.
