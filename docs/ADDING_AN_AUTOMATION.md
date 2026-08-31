# Adding an Automation

This guide keeps departmental tools discoverable, maintainable, and safe as the repository grows.

## 1. Choose a category

Use an existing category whenever possible:

- `certificates-awards`
- `academic-records`
- `research-publications`
- `events-competitions`
- `administrative-operations`
- `reporting-analytics`

Create a new category only when none of these accurately describes the automation.

## 2. Create the module

Use kebab-case names:

```text
automations/<category>/<automation-name>/
```

Recommended layout:

```text
<automation-name>/
├── README.md
├── app/ or scripts/
├── references/
└── samples/
```

Do not commit empty directories merely to reserve future ideas.

## 3. Document the module

Every module README must identify:

- Category and lifecycle status: Planned, Experimental, Live, Deprecated, or Archived.
- Intended departmental users and purpose.
- Required inputs and accepted file formats.
- Generated outputs.
- Complete operating procedure.
- Validation and failure behavior.
- Privacy, data retention, and external-service behavior.
- Local setup, tests, build, and deployment instructions.
- Module owner or responsible role when one is assigned.

## 4. Add non-sensitive examples

- Use fictional names and records.
- Remove signatures, credentials, tokens, and private identifiers.
- Document date, encoding, delimiter, and filename requirements.
- Keep approved source templates in `references/` and generated examples in `samples/`.

## 5. Update discovery indexes

Add the module to:

1. The root `README.md` automation directory.
2. `automations/README.md` under its functional category.

Readers should be able to reach a module README within two clicks from the repository root.

## 6. Decide how it is delivered

- Browser application: document its route and build directory.
- Command-line script: document runtime, command, inputs, and outputs.
- Spreadsheet workflow: document workbook format and protected formulas.
- Internal-only tool: mark it clearly and do not publish secrets or private datasets through GitHub Pages.

Only one application is currently deployed at the GitHub Pages root. When a portal app is introduced, it should provide navigation to all browser modules and the deployment workflow should build that portal.

## 7. Acceptance checklist

- [ ] Module is under the correct category.
- [ ] README contains purpose, inputs, outputs, workflow, privacy, setup, and tests.
- [ ] Samples contain no real student or signature data.
- [ ] Validation errors are explicit and do not silently discard records.
- [ ] Automated tests cover critical transformations and exports.
- [ ] Production build succeeds.
- [ ] Root and automation catalogs link to the module.
- [ ] Deployment path is documented and verified.

