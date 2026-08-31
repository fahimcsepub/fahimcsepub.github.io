import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, emptyRecord } from './certificate';
import { A4_LANDSCAPE, generateCertificatePdf } from './pdf';

const projectRoot = process.cwd();
const assetMap: Record<string, string> = {
  'modern_vintage_blank_background.png': join(projectRoot, 'public', 'assets', 'modern_vintage_blank_background.png'),
  'cse_department_logo_charcoal_gold.png': join(projectRoot, 'public', 'assets', 'cse_department_logo_charcoal_gold.png'),
  'modern_vintage_seal.png': join(projectRoot, 'public', 'assets', 'modern_vintage_seal.png'),
  'pust_classic_border.png': join(projectRoot, 'public', 'assets', 'pust_classic_border.png'),
  'pust_cse_logo_blue.png': join(projectRoot, 'public', 'assets', 'pust_cse_logo_blue.png'),
  'pust_classic_seal.png': join(projectRoot, 'public', 'assets', 'pust_classic_seal.png'),
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
      batch: '12',
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

  it('renders the supplied PUST Classic PowerPoint template as a PDF option', async () => {
    const record = {
      ...emptyRecord(DEFAULT_SETTINGS),
      templateId: 'pust-classic' as const,
      recipientName: 'Md. Forhan Shahriar',
      batch: '27',
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
    if (process.env.CSE_WRITE_SAMPLE === '1') {
      const outputDirectory = join(projectRoot, 'tmp', 'pdfs');
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(join(outputDirectory, 'PUST_Classic_Certificate_Sample.pdf'), bytes);
    }
  }, 15_000);
});
