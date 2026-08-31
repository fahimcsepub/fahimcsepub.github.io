# Certificate Generator

**Category:** Certificates & Awards  
**Status:** Live  
**Live application:** [https://fahimcsepub.github.io/](https://fahimcsepub.github.io/)

This privacy-first browser application generates print-ready A4 landscape certificates for approved Department of CSE recipients. It supports manual generation, mixed-category CSV batches of up to 500 records, automatic numbering, local register management, and multiple export formats.

## Supported awards

- Academic Excellence Award
- Research Excellence Award
- Outstanding Achievement Award
- Course Coordination Excellence Award
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
coordination_period
citation_mode
custom_citation
```

Exact header row:

```csv
recipient_name,award_category,template,achievement_type,academic_scope,study_semester,ranking_group,batch,semester,award_year,issue_date,certificate_number,article_title,journal_name,doi,publication_url,q1_verified,competition_or_event,position_or_award,achievement_area,coordination_period,citation_mode,custom_citation
```

## Mixed-category CSV example

```csv
recipient_name,award_category,template,achievement_type,academic_scope,study_semester,ranking_group,batch,semester,award_year,issue_date,certificate_number,article_title,journal_name,doi,publication_url,q1_verified,competition_or_event,position_or_award,achievement_area,coordination_period,citation_mode,custom_citation
Nusrat Jahan,Academic Excellence Award,PUB Classic Blue,,semester,4th Semester,,,Spring,2026,2026-08-30,,,,,,,,,,,automatic,
Mahmud Hasan,Research Excellence Award,Modern Vintage,,,,,,Spring,2026,2026-08-30,,Efficient Learning for Smart Systems,Example Computing Journal,10.0000/example,https://example.org/article,yes,,,,,automatic,
Team Pundra,Outstanding Achievement Award,PUB Classic Blue,competition,,,,,Spring,2026,2026-08-30,,,,,,National Programming Contest,Champion,,,automatic,
Ayesha Rahman,Outstanding Achievement Award,Modern Vintage,general,,,,,Spring,2026,2026-08-30,,,,,,,,International robotics innovation,,automatic,
Dr. Farhana Islam,Course Coordination Excellence Award,PUB Classic Blue,,,,,,Summer,2026,2026-08-31,,,,,,,,,Spring 2025 – Summer 2026,automatic,
```

## Required fields by award

| Award | Required category-specific data |
|---|---|
| Academic Excellence—semester scope | `recipient_name`, `academic_scope=semester`, `study_semester`, `semester`, `award_year`, `issue_date` |
| Academic Excellence—batch scope | `recipient_name`, `academic_scope=batch`, `batch`, `semester`, `award_year`, `issue_date` |
| Academic Excellence—custom group | `recipient_name`, `academic_scope=custom`, `ranking_group`, `semester`, `award_year`, `issue_date` |
| Research Excellence | `recipient_name`, `article_title`, `journal_name`, result term/year/date; `q1_verified` is optional |
| Outstanding Achievement—competition | `recipient_name`, `achievement_type=competition`, `competition_or_event`, `position_or_award`, result term/year/date |
| Outstanding Achievement—general | `recipient_name`, `achievement_type=general`, `achievement_area`, result term/year/date |
| Course Coordination Excellence | `recipient_name`, `award_category=CCEA`, `coordination_period`, result term/year/date |

## Recommended certificate wording

The certificate displays one concise recognition statement after the recipient name; it does not add a second generic achievement paragraph.

| Award | Automatic wording pattern |
|---|---|
| Academic Excellence—semester scope | `In recognition of securing First Position among all students enrolled in the {{STUDY_SEMESTER}} during the {{TERM}} {{YEAR}} academic term.` |
| Academic Excellence—batch scope | `In recognition of securing First Position among the students of {{BATCH}} during the {{TERM}} {{YEAR}} academic term.` |
| Academic Excellence—custom group | `In recognition of securing First Position among {{RANKING_GROUP}} during the {{TERM}} {{YEAR}} academic term.` |
| Research Excellence—general publication | `In recognition of the publication of the research article “{{ARTICLE_TITLE}}” in {{JOURNAL_NAME}}.` |
| Research Excellence—verified Q1 | `In recognition of the publication of the research article “{{ARTICLE_TITLE}}” in {{JOURNAL_NAME}}, a Q1-ranked journal.` |
| Outstanding Achievement—competition | `In recognition of achieving {{POSITION_OR_AWARD}} at {{COMPETITION_OR_EVENT}}, demonstrating exceptional merit and bringing distinction to the Department of Computer Science & Engineering.` |
| Outstanding Achievement—general | `In recognition of an extraordinary achievement in {{ACHIEVEMENT_AREA}}, bringing distinction to the Department of Computer Science & Engineering.` |
| Course Coordination Excellence | `In recognition of dedicated service and academic leadership upon completing the appointment as Course Coordinator of the Department of Computer Science & Engineering for the period {{COORDINATION_PERIOD}}.` |

Custom wording remains available for exceptional cases, but it must be a complete standalone statement because it replaces the automatic sentence.

## Accepted values and rules

- `issue_date`: use `YYYY-MM-DD`.
- `academic_scope`: `semester` (default), `batch`, or `custom`.
- `study_semester`: the student academic semester, such as `4th Semester`. The interface deliberately uses **Semester**, not Level.
- `semester`: the result term used for numbering: `Spring`, `Summer`, `Fall`, or `Autumn`.
- `template`: `Modern Vintage`, `PUB Classic Blue`, `modern-vintage`, or `pub-classic`. The former `PUST Classic Blue` and `pust-classic` values remain accepted as legacy aliases.
- `award_category`: use the full award name, a configured custom alias, or short aliases `AE`, `RE`, `OA`, and `CCEA`.
- `achievement_type`: use `competition` or `general` for Outstanding Achievement.
- `coordination_period`: the official completed appointment period, such as `Spring 2025 – Summer 2026`.
- `q1_verified`: optional. Accepted true values are `yes`, `true`, `y`, `1`, and `verified`; only a true value adds the Q1 claim. Leave it blank or use `no` for neutral publication wording.
- `certificate_number`: leave blank for automatic numbering, or provide a unique value such as `CSE/SPR-2026/001`.
- `citation_mode`: `automatic` or `custom`. If omitted, a non-empty `custom_citation` automatically selects custom mode for backward compatibility.
- `custom_citation`: required only when `citation_mode=custom`; it replaces the recommended wording.
- Text containing commas or line breaks must be enclosed in double quotation marks.
- Duplicate recipient names are allowed when certificate numbers differ.
- Maximum import size is 500 rows.

## Custom award mappings

**Course Coordination Excellence Award is a permanent official category**, so it does not need to be created or maintained in Settings. CSV files may use `CCEA`, `Course Coordinator`, or the full category name. The former `field_coordination_period` column remains accepted for backward compatibility, but new files should use `coordination_period`.

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
