import Papa from 'papaparse';
import type { BulkRow, CertificateRecord, GeneratorSettings, RegisterEntry } from '../types';
import {
  DEFAULT_SETTINGS,
  TERM_CODES,
  emptyRecord,
  formatCertificateNumber,
  generateCitation,
  getCategoryLabel,
  getCustomAwardMapping,
  getRecordTemplateId,
  normalizeCertificateRecord,
  normalizeCategory,
  normalizeCustomFieldKey,
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
  'academic_scope',
  'study_semester',
  'ranking_group',
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
  'citation_mode',
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

function academicScope(value: string | undefined, batch: string, studySemester: string): CertificateRecord['academicScope'] {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (['batch', 'cohort'].includes(normalized)) return 'batch';
  if (['custom', 'group', 'custom group'].includes(normalized)) return 'custom';
  if (['semester', 'academic semester', 'all semester students'].includes(normalized)) return 'semester';
  if (studySemester) return 'semester';
  return batch ? 'batch' : 'semester';
}

function citationMode(value: string | undefined, customCitation: string): CertificateRecord['citationMode'] {
  const normalized = (value ?? '').trim().toLowerCase();
  if (['custom', 'manual', 'override'].includes(normalized)) return 'custom';
  if (['automatic', 'auto', 'recommended', 'default'].includes(normalized)) return 'automatic';
  return customCitation ? 'custom' : 'automatic';
}

function customFieldsFromRaw(raw: RawRow): Record<string, string> {
  return Object.fromEntries(Object.entries(raw).flatMap(([header, value]) => {
    if (!header.startsWith('field_')) return [];
    const key = normalizeCustomFieldKey(header.slice('field_'.length));
    return key ? [[key, (value ?? '').trim()]] : [];
  }));
}

function parseCustomCategoryFields(value: string | undefined) {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const batch = (raw.batch ?? '').trim();
  const studySemester = (raw.study_semester ?? '').trim();
  const customCitation = (raw.custom_citation ?? '').trim();
  const record = normalizeCertificateRecord({
    ...emptyRecord(settings),
    templateId: normalizedTemplate ?? fallbackTemplate,
    recipientName: (raw.recipient_name ?? '').trim(),
    awardCategory: category ?? 'academic',
    achievementType: achievementType(raw.achievement_type),
    academicScope: academicScope(raw.academic_scope, batch, studySemester),
    studySemester,
    rankingGroup: (raw.ranking_group ?? '').trim(),
    batch,
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
    citationMode: citationMode(raw.citation_mode, customCitation),
    customCitation,
    customFields: customFieldsFromRaw(raw),
    customCategoryLabel: importedCustomLabel || customMapping?.label || '',
    customCategoryTemplate: importedCustomTemplate || customMapping?.citationTemplate || '',
    customCategoryFields: parseCustomCategoryFields(raw.custom_category_fields).length
      ? parseCustomCategoryFields(raw.custom_category_fields)
      : customMapping?.fields ?? [],
    signatureMode: settings.defaultSignatureMode,
    signatureLayout: settings.defaultSignatureLayout,
  }, settings);
  const normalizationErrors: string[] = [];
  if (!category) normalizationErrors.push('Award category is not recognized.');
  if (!semester) normalizationErrors.push('Result term is not recognized. Use Spring, Summer, Fall, or Autumn.');
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

export function sampleCsv(settings = DEFAULT_SETTINGS): string {
  const rows = [
    {
      recipient_name: 'Nusrat Jahan', award_category: 'Academic Excellence Award', template: 'PUB Classic Blue', achievement_type: '', academic_scope: 'semester', study_semester: '4th Semester', ranking_group: '', batch: '', semester: 'Spring', award_year: '2026', issue_date: '2026-08-30', certificate_number: '', article_title: '', journal_name: '', doi: '', publication_url: '', q1_verified: '', competition_or_event: '', position_or_award: '', achievement_area: '', citation_mode: 'automatic', custom_citation: '',
    },
    {
      recipient_name: 'Mahmud Hasan', award_category: 'Research Excellence Award', template: 'Modern Vintage', achievement_type: '', academic_scope: '', study_semester: '', ranking_group: '', batch: '', semester: 'Spring', award_year: '2026', issue_date: '2026-08-30', certificate_number: '', article_title: 'Efficient Learning for Smart Systems', journal_name: 'Example Computing Journal', doi: '10.0000/example', publication_url: 'https://example.org/article', q1_verified: 'yes', competition_or_event: '', position_or_award: '', achievement_area: '', citation_mode: 'automatic', custom_citation: '',
    },
    {
      recipient_name: 'Team Pundra', award_category: 'Outstanding Achievement Award', template: 'PUB Classic Blue', achievement_type: 'competition', academic_scope: '', study_semester: '', ranking_group: '', batch: '', semester: 'Spring', award_year: '2026', issue_date: '2026-08-30', certificate_number: '', article_title: '', journal_name: '', doi: '', publication_url: '', q1_verified: '', competition_or_event: 'National Programming Contest', position_or_award: 'Champion', achievement_area: '', citation_mode: 'automatic', custom_citation: '',
    },
  ];
  const customHeaders = [...new Set(settings.customAwardMappings.flatMap((mapping) => mapping.fields.map((field) => `field_${normalizeCustomFieldKey(field.key)}`)))].filter((header) => header !== 'field_');
  return `\uFEFF${Papa.unparse(rows, { columns: [...CSV_HEADERS, ...customHeaders] })}`;
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
  const customKeys = [...new Set(entries.flatMap((entry) => Object.keys(entry.customFields ?? {}).map(normalizeCustomFieldKey)))].filter(Boolean).sort();
  const rows = entries.map((entry) => ({
    recipient_name: csvSafe(entry.recipientName),
    award_category: csvSafe(getCategoryLabel(entry, settings)),
    template: getRecordTemplateId(entry),
    achievement_type: entry.achievementType,
    academic_scope: entry.academicScope,
    study_semester: csvSafe(entry.studySemester),
    ranking_group: csvSafe(entry.rankingGroup),
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
    citation_mode: entry.citationMode,
    custom_citation: csvSafe(entry.customCitation),
    ...Object.fromEntries(customKeys.map((key) => [`field_${key}`, csvSafe(entry.customFields?.[key] ?? '')])),
    custom_category_label: csvSafe(entry.customCategoryLabel ?? ''),
    custom_category_template: csvSafe(entry.customCategoryTemplate ?? ''),
    custom_category_fields: csvSafe(JSON.stringify(entry.customCategoryFields ?? [])),
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
