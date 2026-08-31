# Certificate Generator

**Category:** Certificates & Awards  
**Status:** Live  
**Live application:** [https://fahimcsepub.github.io/](https://fahimcsepub.github.io/)

This privacy-first browser application generates print-ready A4 landscape certificates for approved Department of CSE recipients. It supports manual generation, mixed-category CSV batches of up to 500 records, automatic numbering, local register management, and multiple export formats.

## Supported awards

- Academic Excellence Award
- Research Excellence Award
- Outstanding Achievement Award
- Course Coordination Excellence Award (ready-made custom mapping)
- Reusable custom award mappings created in Settings

## Certificate templates

**PUB Classic Blue is the official default template** for new certificates and CSV rows that do not specify a template. Users can still select Modern Vintage for an individual certificate or change their saved default in Settings.

- `Modern Vintage`
- `PUB Classic Blue`

Both templates use a centered, seal-free signature block in one-signature mode. Two-signature certificates retain the approved centered seal and their original left/right signature formatting.

The approved source PowerPoint files are retained in [`references/`](references/). Print-ready non-sensitive examples are available in [`samples/pdf/`](samples/pdf/).

## Bulk CSV workflow

1. Open **Bulk import**.
2. Select **Download CSV template**.
3. Open the template in Excel, Google Sheets, or another spreadsheet editor.
4. Keep the header row unchanged.
5. Add one approved recipient per row.
6. Save or download the file as **CSV UTF-8 (Comma delimited)**.
7. Upload the CSV and review every validation result.
8. Correct invalid rows; they are never silently discarded.
9. Generate individual PDFs, a ZIP, a combined PDF, and/or a register CSV.

## CSV columns

```text
recipient_name
award_category
template
achievement_type
academic_scope
study_semester
ranking_group
batch
semester
award_year
issue_date
certificate_number
article_title
journal_name
doi
publication_url
q1_verified
competition_or_event
position_or_award
achievement_area
citation_mode
custom_citation
field_coordination_period
```

Exact header row:

```csv
recipient_name,award_category,template,achievement_type,academic_scope,study_semester,ranking_group,batch,semester,award_year,issue_date,certificate_number,article_title,journal_name,doi,publication_url,q1_verified,competition_or_event,position_or_award,achievement_area,citation_mode,custom_citation,field_coordination_period
```

## Mixed-category CSV example

```csv
recipient_name,award_category,template,achievement_type,academic_scope,study_semester,ranking_group,batch,semester,award_year,issue_date,certificate_number,article_title,journal_name,doi,publication_url,q1_verified,competition_or_event,position_or_award,achievement_area,citation_mode,custom_citation,field_coordination_period
Nusrat Jahan,Academic Excellence Award,PUB Classic Blue,,semester,4th Semester,,,Spring,2026,2026-08-30,,,,,,,,,,automatic,,
Mahmud Hasan,Research Excellence Award,Modern Vintage,,,,,,Spring,2026,2026-08-30,,Efficient Learning for Smart Systems,Example Computing Journal,10.0000/example,https://example.org/article,yes,,,,automatic,,
Team Pundra,Outstanding Achievement Award,PUB Classic Blue,competition,,,,,Spring,2026,2026-08-30,,,,,,National Programming Contest,Champion,,automatic,,
Ayesha Rahman,Outstanding Achievement Award,Modern Vintage,general,,,,,Spring,2026,2026-08-30,,,,,,,,International robotics innovation,automatic,,
```

## Required fields by award

| Award | Required category-specific data |
|---|---|
| Academic Excellence—semester scope | `recipient_name`, `academic_scope=semester`, `study_semester`, `semester`, `award_year`, `issue_date` |
| Academic Excellence—batch scope | `recipient_name`, `academic_scope=batch`, `batch`, `semester`, `award_year`, `issue_date` |
| Academic Excellence—custom group | `recipient_name`, `academic_scope=custom`, `ranking_group`, `semester`, `award_year`, `issue_date` |
| Research Excellence | `recipient_name`, `article_title`, `journal_name`, verified `q1_verified`, result term/year/date |
| Outstanding Achievement—competition | `recipient_name`, `achievement_type=competition`, `competition_or_event`, `position_or_award`, result term/year/date |
| Outstanding Achievement—general | `recipient_name`, `achievement_type=general`, `achievement_area`, result term/year/date |
| Course Coordination Excellence | `recipient_name`, `award_category=CCEA`, `field_coordination_period`, result term/year/date |

## Accepted values and rules

- `issue_date`: use `YYYY-MM-DD`.
- `academic_scope`: `semester` (default), `batch`, or `custom`.
- `study_semester`: the student academic semester, such as `4th Semester`. The interface deliberately uses **Semester**, not Level.
- `semester`: the result term used for numbering: `Spring`, `Summer`, `Fall`, or `Autumn`.
- `template`: `Modern Vintage`, `PUB Classic Blue`, `modern-vintage`, or `pub-classic`. The former `PUST Classic Blue` and `pust-classic` values remain accepted as legacy aliases.
- `award_category`: use the full award name, a configured custom alias, or legacy aliases `AE`, `RE`, and `OA`.
- `achievement_type`: use `competition` or `general` for Outstanding Achievement.
- `q1_verified`: accepted true values are `yes`, `true`, `y`, `1`, and `verified`.
- `certificate_number`: leave blank for automatic numbering, or provide a unique value such as `CSE/SPR-2026/001`.
- `citation_mode`: `automatic` or `custom`. If omitted, a non-empty `custom_citation` automatically selects custom mode for backward compatibility.
- `custom_citation`: required only when `citation_mode=custom`; it replaces the recommended wording.
- Text containing commas or line breaks must be enclosed in double quotation marks.
- Duplicate recipient names are allowed when certificate numbers differ.
- Maximum import size is 500 rows.

## Custom award mappings

The ready-made **Course Coordination Excellence Award** mapping is included for new and existing users. It accepts `CCEA` or `Course Coordinator` in CSV files and uses `field_coordination_period` to fill `{{COORDINATION_PERIOD}}` in its recommended citation. It can be edited, disabled, or removed like any other custom mapping.

1. Open **Settings → Custom award mappings**.
2. Select **Add category**.
3. Enter the category name, description, optional CSV aliases, and whether the mapping is available for new certificates.
4. Add, remove, or reorder the input fields. Each field has a key, label, input type, required setting, help text, and optional dropdown choices.
5. Build the default citation with the common fields and the generated custom field tokens.
6. Use the category name or one of its aliases in the CSV `award_category` column.
7. Supply custom field values in columns named `field_<key>`, such as `field_project_title`.

Available citation placeholders include recipient, award, academic semester, result term, year, research, achievement, date, and custom mapping fields displayed in Settings. An individual certificate or CSV row can switch explicitly between recommended and custom citation wording. Disabling a mapping hides it from new certificates without invalidating its saved register records.

## Numbering

Certificate numbers use a shared semester/year sequence across categories:

```text
CSE/SPR-2026/001
CSE/SUM-2026/001
CSE/FAL-2026/001
```

Leave `certificate_number` blank for automatic allocation. Reprints retain their original number.

## Run locally

```bash
cd automations/certificates-awards/certificate-generator/app
npm install
npm run dev
```

Verification:

```bash
npm run test:run
npm run build
```

## Module structure

```text
certificate-generator/
├── README.md
├── app/          # React, TypeScript, PDF, CSV, register, and worker code
├── references/   # Approved source PowerPoint templates
└── samples/      # Non-sensitive sample outputs
```

## Privacy and operational boundaries

- Certificate data and signature images remain in the browser.
- Signature images are session-only and are not committed or uploaded by the application.
- Browser-local register data can be lost when site data is cleared; export backups regularly.
- Winner selection and CGPA tie-breaking happen before import—the application records approved recipients but does not select winners.
- Do not commit real recipient CSV files, signature images, or issuance-register exports.
