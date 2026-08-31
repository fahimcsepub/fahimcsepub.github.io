import Papa from 'papaparse';
import type { BulkRow, CertificateRecord, GeneratorSettings, RegisterEntry } from '../types';
import {
  TERM_CODES,
  emptyRecord,
  formatCertificateNumber,
  generateCitation,
  getCategoryLabel,
  getCustomAwardMapping,
  getRecordTemplateId,
  normalizeCategory,
  normalizeSemester,
  normalizeTemplateId,
  parseCertificateNumber,
  validateRecord,
} from './certificate';
import { csvSafe } from './download';

export const CSV_HEADERS = [
  'recipient_name',
  'award_category',
  'template',
  'achievement_type',
  'batch',
  'semester',
  'award_year',
  'issue_date',
  'certificate_number',
  'article_title',
  'journal_name',
  'doi',
  'publication_url',
  'q1_verified',
  'competition_or_event',
  'position_or_award',
  'achievement_area',
  'custom_citation',
] as const;

type RawRow = Record<string, string | undefined>;

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function truthy(value: string | undefined): boolean {
  return ['true', 'yes', 'y', '1', 'verified'].includes((value ?? '').trim().toLowerCase());
}

function achievementType(value: string | undefined): 'competition' | 'general' {
  return (value ?? '').trim().toLowerCase().startsWith('gen') ? 'general' : 'competition';
}

function serialKey(term: string, year: string): string {
  return `${term}-${year}`;
}

function makeRecord(
  raw: RawRow,
  settings: GeneratorSettings,
  fallbackTemplate = settings.defaultTemplateId,
): { record: CertificateRecord; normalizationErrors: string[] } {
  const importedCustomLabel = (raw.custom_category_label ?? '').trim();
  const importedCustomTemplate = (raw.custom_category_template ?? '').trim();
  let category = normalizeCategory(raw.award_category ?? '', settings);
  if (!category && importedCustomLabel && importedCustomTemplate) {
    const slug = importedCustomLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'award';
    category = `custom:imported-${slug}`;
  }
  const semester = normalizeSemester(raw.semester ?? '');
  const normalizedTemplate = normalizeTemplateId(raw.template);
  const customMapping = category ? getCustomAwardMapping(category, settings) : undefined;
  const record: CertificateRecord = {
    ...emptyRecord(settings),
    templateId: normalizedTemplate ?? fallbackTemplate,
    recipientName: (raw.recipient_name ?? '').trim(),
    awardCategory: category ?? 'academic',
    achievementType: achievementType(raw.achievement_type),
    batch: (raw.batch ?? '').trim(),
    semester: semester ?? 'Spring',
    awardYear: (raw.award_year ?? '').trim(),
    issueDate: (raw.issue_date ?? '').trim(),
    certificateNumber: (raw.certificate_number ?? '').trim().toUpperCase(),
    articleTitle: (raw.article_title ?? '').trim(),
    journalName: (raw.journal_name ?? '').trim(),
    doi: (raw.doi ?? '').trim(),
    publicationUrl: (raw.publication_url ?? '').trim(),
    q1Verified: truthy(raw.q1_verified),
    competitionOrEvent: (raw.competition_or_event ?? '').trim(),
    positionOrAward: (raw.position_or_award ?? '').trim(),
    achievementArea: (raw.achievement_area ?? '').trim(),
    customCitation: (raw.custom_citation ?? '').trim(),
    customCategoryLabel: importedCustomLabel || customMapping?.label || '',
    customCategoryTemplate: importedCustomTemplate || customMapping?.citationTemplate || '',
    signatureMode: settings.defaultSignatureMode,
    signatureLayout: settings.defaultSignatureLayout,
  };
  const normalizationErrors: string[] = [];
  if (!category) normalizationErrors.push('Award category is not recognized.');
  if (!semester) normalizationErrors.push('Semester is not recognized.');
  if (raw.template?.trim() && !normalizedTemplate) normalizationErrors.push('Certificate template is not recognized.');
  return { record, normalizationErrors };
}

export function parseBulkCsv(
  text: string,
  settings: GeneratorSettings,
  register: RegisterEntry[],
): { rows: BulkRow[]; fileErrors: string[] } {
  const parsed = Papa.parse<RawRow>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  });
  const fileErrors = parsed.errors.map((error) => `CSV row ${(error.row ?? 0) + 2}: ${error.message}`);
  if (parsed.data.length > 500) fileErrors.push('A maximum of 500 certificate rows can be processed at once.');

  const maxSerial = new Map<string, number>();
  const usedNumbers = new Set<string>();
  register.forEach((entry) => {
    usedNumbers.add(entry.certificateNumber.toUpperCase());
    const number = parseCertificateNumber(entry.certificateNumber);
    if (number) {
      const key = serialKey(number.term, number.year);
      maxSerial.set(key, Math.max(maxSerial.get(key) ?? 0, number.serial));
    }
  });

  const rows = parsed.data.slice(0, 500).map((raw, index): BulkRow => {
    const { record, normalizationErrors } = makeRecord(raw, settings);
    if (!record.certificateNumber && /^\d{4}$/.test(record.awardYear)) {
      const key = serialKey(TERM_CODES[record.semester], record.awardYear);
      const serial = (maxSerial.get(key) ?? 0) + 1;
      maxSerial.set(key, serial);
      record.certificateNumber = formatCertificateNumber(settings.numberPrefix, record.semester, record.awardYear, serial);
    }
    const duplicate = record.certificateNumber && usedNumbers.has(record.certificateNumber.toUpperCase());
    if (record.certificateNumber) usedNumbers.add(record.certificateNumber.toUpperCase());
    const errors = [...normalizationErrors, ...validateRecord(record, settings)];
    if (duplicate) errors.push('Certificate number is duplicated in the register or uploaded file.');
    return {
      id: `${Date.now()}-${index}`,
      sourceLine: index + 2,
      record,
      errors: [...new Set(errors)],
    };
  });
  return { rows, fileErrors };
}

export function revalidateBulkRows(rows: BulkRow[], register: RegisterEntry[], settings: GeneratorSettings): BulkRow[] {
  const used = new Set(register.map((entry) => entry.certificateNumber.toUpperCase()));
  return rows.map((row) => {
    const errors = validateRecord(row.record, settings);
    const number = row.record.certificateNumber.toUpperCase();
    if (used.has(number)) errors.push('Certificate number is duplicated in the register or uploaded file.');
    used.add(number);
    return { ...row, errors: [...new Set(errors)] };
  });
}

export function sampleCsv(): string {
  const rows = [
    {
      recipient_name: 'Nusrat Jahan', award_category: 'Academic Excellence Award', template: 'PUB Classic Blue', achievement_type: '', batch: '12', semester: 'Spring', award_year: '2026', issue_date: '2026-08-30', certificate_number: '', article_title: '', journal_name: '', doi: '', publication_url: '', q1_verified: '', competition_or_event: '', position_or_award: '', achievement_area: '', custom_citation: '',
    },
    {
      recipient_name: 'Mahmud Hasan', award_category: 'Research Excellence Award', template: 'Modern Vintage', achievement_type: '', batch: '', semester: 'Spring', award_year: '2026', issue_date: '2026-08-30', certificate_number: '', article_title: 'Efficient Learning for Smart Systems', journal_name: 'Example Computing Journal', doi: '10.0000/example', publication_url: 'https://example.org/article', q1_verified: 'yes', competition_or_event: '', position_or_award: '', achievement_area: '', custom_citation: '',
    },
    {
      recipient_name: 'Team Pundra', award_category: 'Outstanding Achievement Award', template: 'PUB Classic Blue', achievement_type: 'competition', batch: '', semester: 'Spring', award_year: '2026', issue_date: '2026-08-30', certificate_number: '', article_title: '', journal_name: '', doi: '', publication_url: '', q1_verified: '', competition_or_event: 'National Programming Contest', position_or_award: 'Champion', achievement_area: '', custom_citation: '',
    },
  ];
  return `\uFEFF${Papa.unparse(rows, { columns: [...CSV_HEADERS] })}`;
}

export function errorCsv(rows: BulkRow[]): string {
  const invalid = rows.filter((row) => row.errors.length > 0).map((row) => ({
    source_line: row.sourceLine,
    recipient_name: row.record.recipientName,
    certificate_number: row.record.certificateNumber,
    errors: row.errors.join(' | '),
  }));
  return `\uFEFF${Papa.unparse(invalid)}`;
}

export function registerCsv(entries: RegisterEntry[], settings: GeneratorSettings): string {
  const rows = entries.map((entry) => ({
    recipient_name: csvSafe(entry.recipientName),
    award_category: csvSafe(getCategoryLabel(entry, settings)),
    template: getRecordTemplateId(entry),
    achievement_type: entry.achievementType,
    batch: csvSafe(entry.batch),
    semester: entry.semester,
    award_year: entry.awardYear,
    issue_date: entry.issueDate,
    certificate_number: csvSafe(entry.certificateNumber),
    article_title: csvSafe(entry.articleTitle),
    journal_name: csvSafe(entry.journalName),
    doi: csvSafe(entry.doi),
    publication_url: csvSafe(entry.publicationUrl),
    q1_verified: entry.q1Verified ? 'yes' : 'no',
    competition_or_event: csvSafe(entry.competitionOrEvent),
    position_or_award: csvSafe(entry.positionOrAward),
    achievement_area: csvSafe(entry.achievementArea),
    custom_citation: csvSafe(entry.customCitation),
    custom_category_label: csvSafe(entry.customCategoryLabel ?? ''),
    custom_category_template: csvSafe(entry.customCategoryTemplate ?? ''),
    citation: csvSafe(entry.citation),
    generated_at: entry.generatedAt,
    last_generated_at: entry.lastGeneratedAt,
    reprint_count: entry.reprintCount,
  }));
  return `\uFEFF${Papa.unparse(rows)}`;
}

export function rowsToRegisterEntries(rows: BulkRow[], settings: GeneratorSettings): RegisterEntry[] {
  const now = new Date().toISOString();
  return rows.map(({ record }) => ({
    ...record,
    citation: generateCitation(record, settings),
    generatedAt: now,
    lastGeneratedAt: now,
    reprintCount: 0,
  }));
}

export function parseRegisterCsv(
  text: string,
  settings: GeneratorSettings,
): { entries: RegisterEntry[]; errors: string[] } {
  const parsed = Papa.parse<RawRow>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  });
  const errors = parsed.errors.map((error) => `CSV row ${(error.row ?? 0) + 2}: ${error.message}`);
  const entries: RegisterEntry[] = [];
  parsed.data.forEach((raw, index) => {
    const { record, normalizationErrors } = makeRecord(raw, settings, 'modern-vintage');
    const rowErrors = [...normalizationErrors, ...validateRecord(record, settings)];
    if (rowErrors.length) {
      errors.push(`CSV row ${index + 2}: ${rowErrors.join(' ')}`);
      return;
    }
    const now = new Date().toISOString();
    entries.push({
      ...record,
      citation: raw.citation?.trim() || generateCitation(record, settings),
      generatedAt: raw.generated_at?.trim() || now,
      lastGeneratedAt: raw.last_generated_at?.trim() || raw.generated_at?.trim() || now,
      reprintCount: Number(raw.reprint_count ?? 0) || 0,
    });
  });
  return { entries, errors };
}
