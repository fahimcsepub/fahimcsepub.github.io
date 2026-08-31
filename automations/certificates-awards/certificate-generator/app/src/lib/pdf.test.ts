import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, emptyRecord } from './certificate';
import { A4_LANDSCAPE, generateCertificatePdf } from './pdf';

const projectRoot = process.cwd();
const assetMap: Record<string, string> = {
  'modern_vintage_blank_background.png': join(projectRoot, 'public', 'assets', 'modern_vintage_blank_background.png'),
  'cse_department_logo_charcoal_gold.png': join(projectRoot, 'public', 'assets', 'cse_department_logo_charcoal_gold.png'),
  'modern_vintage_seal.png': join(projectRoot, 'public', 'assets', 'modern_vintage_seal.png'),
  'pub_classic_border.png': join(projectRoot, 'public', 'assets', 'pub_classic_border.png'),
  'pub_cse_logo_blue.png': join(projectRoot, 'public', 'assets', 'pub_cse_logo_blue.png'),
  'pub_classic_seal.png': join(projectRoot, 'public', 'assets', 'pub_classic_seal.png'),
  'libre-baskerville-latin-400-normal.woff': join(projectRoot, 'node_modules', '@fontsource', 'libre-baskerville', 'files', 'libre-baskerville-latin-400-normal.woff'),
  'libre-baskerville-latin-400-italic.woff': join(projectRoot, 'node_modules', '@fontsource', 'libre-baskerville', 'files', 'libre-baskerville-latin-400-italic.woff'),
  'libre-baskerville-latin-700-normal.woff': join(projectRoot, 'node_modules', '@fontsource', 'libre-baskerville', 'files', 'libre-baskerville-latin-700-normal.woff'),
  'source-sans-3-latin-400-normal.woff': join(projectRoot, 'node_modules', '@fontsource', 'source-sans-3', 'files', 'source-sans-3-latin-400-normal.woff'),
  'source-sans-3-latin-700-normal.woff': join(projectRoot, 'node_modules', '@fontsource', 'source-sans-3', 'files', 'source-sans-3-latin-700-normal.woff'),
  'noto-serif-bengali-bengali-400-normal.woff': join(projectRoot, 'node_modules', '@fontsource', 'noto-serif-bengali', 'files', 'noto-serif-bengali-bengali-400-normal.woff'),
  'noto-serif-bengali-bengali-700-normal.woff': join(projectRoot, 'node_modules', '@fontsource', 'noto-serif-bengali', 'files', 'noto-serif-bengali-bengali-700-normal.woff'),
};

beforeAll(() => {
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = String(input);
    const path = assetMap[basename(new URL(url, 'http://test.local').pathname)];
    if (!path) return new Response('Not found', { status: 404 });
    return new Response(await readFile(path), { status: 200 });
  });
});

describe('PDF generation', () => {
  it('creates a one-page A4 landscape certificate without template tokens', async () => {
    const record = {
      ...emptyRecord(DEFAULT_SETTINGS),
      recipientName: 'Nusrat Jahan',
      studySemester: '4th Semester',
      awardYear: '2026',
      issueDate: '2026-08-30',
      certificateNumber: 'CSE/SPR-2026/001',
    };
    const bytes = await generateCertificatePdf(record, {
      settings: DEFAULT_SETTINGS,
      assetBaseUrl: 'http://test.local/assets/',
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(A4_LANDSCAPE[0], 1);
    expect(pdf.getPage(0).getSize().height).toBeCloseTo(A4_LANDSCAPE[1], 1);
    expect(pdf.getTitle()).toBe('Academic Excellence Award - Nusrat Jahan');
    expect(`${pdf.getTitle()} ${pdf.getSubject()}`).not.toMatch(/\{\{|PLACEHOLDER|ENTER NAME/i);
    if (process.env.CSE_WRITE_SAMPLE === '1') {
      const outputDirectory = join(projectRoot, 'tmp', 'pdfs');
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(join(outputDirectory, 'CSE_Certificate_Generator_Sample.pdf'), bytes);
    }
  }, 15_000);

  it('renders the supplied PUB Classic PowerPoint template as a PDF option', async () => {
    const record = {
      ...emptyRecord(DEFAULT_SETTINGS),
      templateId: 'pub-classic' as const,
      recipientName: 'Md. Forhan Shahriar',
      studySemester: '6th Semester',
      awardYear: '2024',
      issueDate: '2024-12-30',
      certificateNumber: 'CSE/SPR-2024/001',
    };
    const bytes = await generateCertificatePdf(record, {
      settings: DEFAULT_SETTINGS,
      assetBaseUrl: 'http://test.local/assets/',
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(A4_LANDSCAPE[0], 1);
    expect(pdf.getTitle()).toBe('Academic Excellence Award - Md. Forhan Shahriar');
    expect(`${pdf.getTitle()} ${pdf.getSubject()}`).not.toMatch(/\{\{|PLACEHOLDER|ENTER NAME/i);
    const xObjects = pdf.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    expect(xObjects?.keys()).toHaveLength(3);
    if (process.env.CSE_WRITE_SAMPLE === '1') {
      const outputDirectory = join(projectRoot, 'tmp', 'pdfs');
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(join(outputDirectory, 'PUB_Classic_Certificate_Sample.pdf'), bytes);
    }
  }, 15_000);

  it('renders a clear one-signature layout in both certificate templates', async () => {
    const baseRecord = {
      ...emptyRecord(DEFAULT_SETTINGS),
      recipientName: 'Ankar Kumar Saha',
      studySemester: '5th Semester',
      semester: 'Summer' as const,
      awardYear: '2026',
      issueDate: '2026-08-31',
      certificateNumber: 'CSE/SUM-2026/002',
      signatureLayout: 'one' as const,
      citationMode: 'custom' as const,
      customCitation: 'For an exceptional achievement in Academic Duty, bringing distinction to the Department of Computer Science & Engineering.',
    };
    const previews = await Promise.all((['pub-classic', 'modern-vintage'] as const).map(async (templateId) => ({
      templateId,
      bytes: await generateCertificatePdf({ ...baseRecord, templateId }, {
        settings: DEFAULT_SETTINGS,
        assetBaseUrl: 'http://test.local/assets/',
      }),
    })));

    for (const preview of previews) {
      const pdf = await PDFDocument.load(preview.bytes);
      expect(pdf.getPageCount()).toBe(1);
      expect(pdf.getPage(0).getSize().width).toBeCloseTo(A4_LANDSCAPE[0], 1);
      const xObjects = pdf.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
      expect(xObjects?.keys()).toHaveLength(2);
    }

    if (process.env.CSE_WRITE_ONE_SIGNATURE_PREVIEW === '1') {
      const outputDirectory = resolve(projectRoot, '..', '..', '..', '..', 'output', 'pdf');
      await mkdir(outputDirectory, { recursive: true });
      for (const preview of previews) {
        await writeFile(join(outputDirectory, `one-signature-${preview.templateId}-preview.pdf`), preview.bytes);
      }
    }
  }, 15_000);

  it('renders concise wording previews for every official award', async () => {
    const baseRecord = {
      ...emptyRecord(DEFAULT_SETTINGS),
      recipientName: 'Approved Recipient',
      awardYear: '2026',
      issueDate: '2026-08-31',
    };
    const records = [
      { ...baseRecord, templateId: 'pub-classic' as const, studySemester: '1st Semester', certificateNumber: 'CSE/SPR-2026/001' },
      { ...baseRecord, templateId: 'modern-vintage' as const, awardCategory: 'research' as const, articleTitle: 'Responsible Computing', journalName: 'Journal of Computing', q1Verified: false, certificateNumber: 'CSE/SPR-2026/002' },
      { ...baseRecord, templateId: 'pub-classic' as const, awardCategory: 'research' as const, articleTitle: 'Responsible Computing', journalName: 'Journal of Computing', q1Verified: true, certificateNumber: 'CSE/SPR-2026/003' },
      { ...baseRecord, templateId: 'pub-classic' as const, awardCategory: 'outstanding' as const, achievementType: 'competition' as const, positionOrAward: 'First Place', competitionOrEvent: 'National Photography Competition', certificateNumber: 'CSE/SPR-2026/004' },
      { ...baseRecord, templateId: 'modern-vintage' as const, awardCategory: 'coordination' as const, coordinationPeriod: 'Spring 2025 – Summer 2026', certificateNumber: 'CSE/SUM-2026/001' },
    ];
    const previews = await Promise.all(records.map(async (record) => ({
      record,
      bytes: await generateCertificatePdf(record, {
        settings: DEFAULT_SETTINGS,
        assetBaseUrl: 'http://test.local/assets/',
      }),
    })));

    for (const preview of previews) {
      const pdf = await PDFDocument.load(preview.bytes);
      expect(pdf.getSubject()).toMatch(/^In recognition of /);
      expect(pdf.getSubject()).not.toContain('exemplary commitment to excellence');
      expect((pdf.getSubject()?.match(/in recognition/gi) ?? [])).toHaveLength(1);
    }

    if (process.env.CSE_WRITE_WORDING_PREVIEWS === '1') {
      const outputDirectory = join(projectRoot, 'tmp', 'pdfs', 'wording-review', 'updated');
      await mkdir(outputDirectory, { recursive: true });
      for (const preview of previews) {
        const label = preview.record.awardCategory.replace(/[^a-z]+/g, '-');
        await writeFile(join(outputDirectory, `${label}-${preview.record.templateId}.pdf`), preview.bytes);
      }
    }
  }, 20_000);
});
