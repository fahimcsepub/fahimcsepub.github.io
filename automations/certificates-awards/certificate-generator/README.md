# Certificate Generator

**Category:** Certificates & Awards  
**Status:** Live  
**Live application:** [https://fahimcsepub.github.io/](https://fahimcsepub.github.io/)

This privacy-first browser application generates print-ready A4 landscape certificates for approved Department of CSE recipients. It supports manual generation, mixed-category CSV batches of up to 500 records, automatic numbering, local register management, and multiple export formats.

## Supported awards

- Academic Excellence Award
- Research Excellence Award
- Outstanding Achievement Award
- Reusable custom award mappings created in Settings

## Certificate templates

**PUST Classic Blue is the official default template** for new certificates and CSV rows that do not specify a template. Users can still select Modern Vintage for an individual certificate or change their saved default in Settings.

- `Modern Vintage`
- `PUST Classic Blue`

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
custom_citation
```

Exact header row:

```csv
recipient_name,award_category,template,achievement_type,batch,semester,award_year,issue_date,certificate_number,article_title,journal_name,doi,publication_url,q1_verified,competition_or_event,position_or_award,achievement_area,custom_citation
```

## Mixed-category CSV example

```csv
recipient_name,award_category,template,achievement_type,batch,semester,award_year,issue_date,certificate_number,article_title,journal_name,doi,publication_url,q1_verified,competition_or_event,position_or_award,achievement_area,custom_citation
Nusrat Jahan,Academic Excellence Award,PUST Classic Blue,,12,Spring,2026,2026-08-30,,,,,,,,,,
Mahmud Hasan,Research Excellence Award,Modern Vintage,,,Spring,2026,2026-08-30,,Efficient Learning for Smart Systems,Example Computing Journal,10.0000/example,https://example.org/article,yes,,,,
Team Pundra,Outstanding Achievement Award,PUST Classic Blue,competition,,Spring,2026,2026-08-30,,,,,,,National Programming Contest,Champion,,
Ayesha Rahman,Outstanding Achievement Award,Modern Vintage,general,,Spring,2026,2026-08-30,,,,,,,,,International robotics innovation,
```

## Required fields by award

| Award | Required category-specific data |
|---|---|
| Academic Excellence | `recipient_name`, `batch`, `semester`, `award_year`, `issue_date` |
| Research Excellence | `recipient_name`, `article_title`, `journal_name`, verified `q1_verified`, semester/year/date |
| Outstanding Achievement—competition | `recipient_name`, `achievement_type=competition`, `competition_or_event`, `position_or_award`, semester/year/date |
| Outstanding Achievement—general | `recipient_name`, `achievement_type=general`, `achievement_area`, semester/year/date |

## Accepted values and rules

- `issue_date`: use `YYYY-MM-DD`.
- `semester`: `Spring`, `Summer`, `Fall`, or `Autumn`.
- `template`: `Modern Vintage`, `PUST Classic Blue`, `modern-vintage`, or `pust-classic`.
- `award_category`: use the full award name, a configured custom alias, or legacy aliases `AE`, `RE`, and `OA`.
- `achievement_type`: use `competition` or `general` for Outstanding Achievement.
- `q1_verified`: accepted true values are `yes`, `true`, `y`, `1`, and `verified`.
- `certificate_number`: leave blank for automatic numbering, or provide a unique value such as `CSE/SPR-2026/001`.
- `custom_citation`: optional; when present, it replaces the automatically generated citation.
- Text containing commas or line breaks must be enclosed in double quotation marks.
- Duplicate recipient names are allowed when certificate numbers differ.
- Maximum import size is 500 rows.

## Custom award mappings

1. Open **Settings → Custom award mappings**.
2. Select **Add category**.
3. Enter the category name, optional CSV aliases, and default citation template.
4. Save the settings in the current browser.
5. Use the category name or one of its aliases in the CSV `award_category` column.

Available citation placeholders include recipient and award fields displayed in Settings. An individual row can still override the mapping through `custom_citation`.

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
