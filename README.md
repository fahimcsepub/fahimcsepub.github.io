# PUB Dept. CSE Automations

This repository is the starting point for the Department of CSE automation portal at Pundra University. Its first complete module is a privacy-first certificate generator that creates print-ready A4 landscape PDFs entirely in the browser. It supports single and CSV bulk workflows and keeps the issuance register only on the current device.

## Included workflows

- Academic Excellence, Research Excellence, and Outstanding Achievement certificates
- Two selectable certificate designs: **Modern Vintage** and **PUST Classic Blue**, recreated from the approved PowerPoint references
- Reusable custom award categories with editable citation templates and CSV aliases
- `CSE/SPR-2026/001` style semester-based numbering
- Live export-accurate PDF preview
- Wet-signature lines or session-only transparent signature images
- CSV import for up to 500 recipients
- Individual PDFs in ZIP groups, a combined PDF, and register CSV export
- Local certificate register with search, backup, reprint, import, and conflict checks

## Run locally

Requirements: Node.js 22.13 or newer (Node.js 24 LTS is recommended).

```bash
cd "Certificate Generation/site-app"
npm install
npm run dev
```

Production checks:

```bash
npm run test:run
npm run build
```

## Publish with GitHub Pages

1. Create an empty GitHub repository with `main` as its default branch.
2. Upload the **contents of this project folder**—including `.github`, `site-app`, `reference`, `.gitignore`, and this README—to the repository root. Do not upload `site-app/node_modules`; Git ignores it automatically.
3. Open **Settings → Pages** in the repository.
4. Select **GitHub Actions** as the Pages source.
5. Push to `main` or manually run the **Deploy PUB CSE Automations** workflow from the Actions tab.

The included workflow installs dependencies, runs the automated tests, builds the app, and publishes it. The Vite build uses relative paths and includes `.nojekyll`, so it works on both account-level and repository-level GitHub Pages sites.

Both approved PowerPoint files are retained only as design references under `reference/`. The live app uses aligned artwork from `site-app/public/assets/`; users do not need PowerPoint to generate certificates. Select the design from **Generate → Certificate template**. Bulk CSV files can use the `template` column; accepted values include `Modern Vintage`, `Pust Classic`, `modern-vintage`, and `pust-classic`.

### Optional Git command workflow

```bash
git init
git add .
git commit -m "Initial PUB CSE automations certificate generator"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

Future department tools can be added as additional modules without changing the certificate records or PDF renderer.

## Privacy and official use

No recipient data, signature image, or PDF is sent to a server. Browser storage can be cleared by the user or browser, so export the issuance register regularly. Upload only signatures that the relevant authority has approved for digital use; signature files are never saved by the app.
