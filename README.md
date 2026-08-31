# PUB Dept. CSE Automations

A modular collection of browser-based tools for the Department of Computer Science & Engineering at Pundra University. Each automation lives under a functional category with its own documentation, application code, references, samples, inputs, and outputs.

Developer and AI-tool handoff information is maintained in [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). Codex and Claude load it through the repository-level `AGENTS.md` and `CLAUDE.md` files.

**Live portal:** [https://fahimcsepub.github.io/](https://fahimcsepub.github.io/)

## Automation directory

| Category | Automation | Status | Inputs | Outputs |
|---|---|---:|---|---|
| Certificates & Awards | [Certificate Generator](automations/certificates-awards/certificate-generator/README.md) | Live | Manual form or UTF-8 CSV | PDF, combined PDF, ZIP, register CSV |

The [complete automation catalog](automations/README.md) groups current and future modules by departmental function.

## Repository organization

```text
PUB-CSE-Automations/
├── automations/
│   ├── README.md
│   └── certificates-awards/
│       └── certificate-generator/
│           ├── README.md
│           ├── app/
│           ├── references/
│           └── samples/
├── docs/
│   └── ADDING_AN_AUTOMATION.md
├── .github/workflows/
└── README.md
```

Every module should follow the same pattern:

- `README.md` — purpose, users, workflow, data format, privacy, testing, and deployment.
- `app/` — the executable application or scripts.
- `references/` — approved source documents, templates, or specifications.
- `samples/` — non-sensitive example inputs and outputs.

## Finding an automation

1. Open the [automation catalog](automations/README.md).
2. Find the relevant functional category.
3. Open the module README before using its application.
4. Review its required inputs, generated outputs, privacy rules, and operating instructions.

Recommended functional categories are:

- `certificates-awards`
- `academic-records`
- `research-publications`
- `events-competitions`
- `administrative-operations`
- `reporting-analytics`

## Current live module

The first production module is the Certificate Generator. It supports:

- Academic Excellence, Research Excellence, and Outstanding Achievement awards.
- Modern Vintage and PUB Classic Blue templates.
- Single-certificate and CSV bulk generation.
- Custom award-category mappings and citation templates.
- Automatic `CSE/SPR-2026/001` style numbering.
- Wet-signature lines or authorized session-only signature images.
- PDF, combined PDF, ZIP, and issuance-register exports.
- A browser-local searchable register and reprinting.

See the [Certificate Generator documentation](automations/certificates-awards/certificate-generator/README.md) for the complete CSV specification and operating procedure.

## Run the current application locally

Requirements: Node.js 22.13 or newer. Node.js 24 LTS is recommended.

```bash
cd automations/certificates-awards/certificate-generator/app
npm install
npm run dev
```

Production verification:

```bash
npm run test:run
npm run build
```

## GitHub Pages deployment

The workflow at `.github/workflows/deploy.yml` currently deploys the Certificate Generator as the root portal application.

On every push to `main`, GitHub Actions:

1. Installs dependencies.
2. Runs automated tests.
3. Builds the selected production application.
4. Publishes the result to GitHub Pages.

When a multi-module portal is introduced later, change the workflow build path to the portal application and expose each automation through its own route or navigation entry.

## Adding another automation

Do not place new tools at the repository root. Add each one under an appropriate category:

```text
automations/<category>/<automation-name>/
```

Then add it to both the root automation directory and `automations/README.md`. Follow the full [automation contribution guide](docs/ADDING_AN_AUTOMATION.md).

## Privacy and official use

- Do not commit student records, private CSV files, real signature images, credentials, or generated issuance registers.
- Keep sample data fictional and non-sensitive.
- Document whether an automation operates locally or transmits data externally.
- Require authorization before embedding or using an official digital signature.
- Back up browser-local records when a module stores data only on the current device.
