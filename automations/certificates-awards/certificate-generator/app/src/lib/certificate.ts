import { z } from 'zod';
import type {
  AwardCategory,
  BuiltInAwardCategory,
  CertificateTemplateId,
  CertificateRecord,
  CustomAwardMapping,
  GeneratorSettings,
  Semester,
} from '../types';

export const CATEGORY_LABELS: Record<BuiltInAwardCategory, string> = {
  academic: 'Academic Excellence Award',
  research: 'Research Excellence Award',
  outstanding: 'Outstanding Achievement Award',
};

export const TERM_CODES: Record<Semester, string> = {
  Spring: 'SPR',
  Summer: 'SUM',
  Fall: 'FAL',
};

export const CERTIFICATE_TEMPLATES: Array<{
  id: CertificateTemplateId;
  label: string;
  description: string;
}> = [
  {
    id: 'modern-vintage',
    label: 'Modern Vintage',
    description: 'Charcoal-and-gold ornamental certificate.',
  },
  {
    id: 'pub-classic',
    label: 'PUB Classic Blue',
    description: 'Official blue-and-gold layout from the supplied PUB PowerPoint.',
  },
];

export const DEFAULT_SETTINGS: GeneratorSettings = {
  universityName: 'Pundra University of Science & Technology',
  departmentName: 'Department of Computer Science & Engineering',
  certificateTitle: 'Certificate of Excellence',
  numberPrefix: 'CSE',
  signatoryOneLabel: 'Head of the Department',
  signatoryTwoLabel: 'Dean, Faculty of Science & Engineering',
  defaultSignatureMode: 'wet',
  defaultSignatureLayout: 'two',
  defaultTemplateId: 'pub-classic',
  customAwardMappings: [],
};

export const CUSTOM_TEMPLATE_TOKENS = [
  '{{RECIPIENT_NAME}}',
  '{{ACHIEVEMENT_AREA}}',
  '{{BATCH}}',
  '{{SEMESTER}}',
  '{{YEAR}}',
] as const;

export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function emptyRecord(settings = DEFAULT_SETTINGS): CertificateRecord {
  const year = String(new Date().getFullYear());
  return {
    templateId: settings.defaultTemplateId,
    recipientName: '',
    awardCategory: 'academic',
    achievementType: 'competition',
    batch: '',
    semester: 'Spring',
    awardYear: year,
    issueDate: todayIso(),
    certificateNumber: '',
    articleTitle: '',
    journalName: '',
    doi: '',
    publicationUrl: '',
    q1Verified: false,
    competitionOrEvent: '',
    positionOrAward: '',
    achievementArea: '',
    customCitation: '',
    customCategoryLabel: '',
    customCategoryTemplate: '',
    signatureMode: settings.defaultSignatureMode,
    signatureLayout: settings.defaultSignatureLayout,
  };
}

export function normalizeTemplateId(value: string | undefined): CertificateTemplateId | null {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (['modern-vintage', 'modern', 'vintage', 'template-1'].includes(normalized)) return 'modern-vintage';
  if (['pub-classic', 'pub-classic-blue', 'pust-classic', 'pust-classic-blue', 'classic', 'classic-blue', 'template-2'].includes(normalized)) return 'pub-classic';
  return null;
}

export function getRecordTemplateId(record: CertificateRecord): CertificateTemplateId {
  return normalizeTemplateId(record.templateId) ?? 'modern-vintage';
}

export function getTemplateLabel(templateId: CertificateTemplateId | undefined): string {
  const normalized = normalizeTemplateId(templateId) ?? 'modern-vintage';
  return CERTIFICATE_TEMPLATES.find((template) => template.id === normalized)?.label ?? 'Modern Vintage';
}

export function normalizeSemester(value: string): Semester | null {
  const normalized = value.trim().toLowerCase();
  if (['spring', 'spr'].includes(normalized)) return 'Spring';
  if (['summer', 'sum'].includes(normalized)) return 'Summer';
  if (['fall', 'autumn', 'fal'].includes(normalized)) return 'Fall';
  return null;
}

export function normalizeCategory(value: string, settings = DEFAULT_SETTINGS): AwardCategory | null {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (['ae', 'academic', 'academic excellence', 'academic excellence award'].includes(normalized)) return 'academic';
  if (['re', 'research', 'research excellence', 'research excellence award'].includes(normalized)) return 'research';
  if (['oa', 'outstanding', 'outstanding achievement', 'outstanding achievement award'].includes(normalized)) return 'outstanding';
  const customMatches = settings.customAwardMappings.filter((mapping) => {
    const candidates = [mapping.id, mapping.label, ...mapping.aliases]
      .map((candidate) => candidate.trim().toLowerCase().replace(/[_-]+/g, ' '));
    return candidates.includes(normalized);
  });
  if (customMatches.length === 1) return customMatches[0].id;
  return null;
}

export function isCustomCategory(category: AwardCategory): category is `custom:${string}` {
  return category.startsWith('custom:');
}

export function getCustomAwardMapping(category: AwardCategory, settings = DEFAULT_SETTINGS): CustomAwardMapping | undefined {
  return isCustomCategory(category)
    ? settings.customAwardMappings.find((mapping) => mapping.id === category)
    : undefined;
}

export function getCategoryLabel(recordOrCategory: CertificateRecord | AwardCategory, settings = DEFAULT_SETTINGS): string {
  const category = typeof recordOrCategory === 'string' ? recordOrCategory : recordOrCategory.awardCategory;
  if (!isCustomCategory(category)) return CATEGORY_LABELS[category];
  if (typeof recordOrCategory !== 'string' && recordOrCategory.customCategoryLabel?.trim()) {
    return recordOrCategory.customCategoryLabel.trim();
  }
  return getCustomAwardMapping(category, settings)?.label ?? 'Custom Excellence Award';
}

export function getAwardOptions(settings = DEFAULT_SETTINGS): Array<{ id: AwardCategory; label: string }> {
  return [
    { id: 'academic', label: CATEGORY_LABELS.academic },
    { id: 'research', label: CATEGORY_LABELS.research },
    { id: 'outstanding', label: CATEGORY_LABELS.outstanding },
    ...settings.customAwardMappings.map((mapping) => ({ id: mapping.id, label: mapping.label })),
  ];
}

function renderCustomTemplate(template: string, record: CertificateRecord): string {
  const values: Record<(typeof CUSTOM_TEMPLATE_TOKENS)[number], string> = {
    '{{RECIPIENT_NAME}}': record.recipientName.trim(),
    '{{ACHIEVEMENT_AREA}}': record.achievementArea.trim(),
    '{{BATCH}}': record.batch.trim(),
    '{{SEMESTER}}': record.semester,
    '{{YEAR}}': record.awardYear.trim(),
  };
  return CUSTOM_TEMPLATE_TOKENS.reduce(
    (citation, token) => citation.split(token).join(values[token]),
    template,
  ).trim();
}

export function generateCitation(record: CertificateRecord, settings = DEFAULT_SETTINGS): string {
  if (record.customCitation.trim()) return record.customCitation.trim();
  if (record.awardCategory === 'academic') {
    return `For securing First Position among the students of Batch ${record.batch.trim()} in the ${record.semester} ${record.awardYear.trim()} Semester, in recognition of outstanding academic performance.`;
  }
  if (record.awardCategory === 'research') {
    return `For publishing the research article titled “${record.articleTitle.trim()}” in ${record.journalName.trim()}, a Q1-ranked journal, demonstrating excellence in scholarly research.`;
  }
  if (record.awardCategory === 'outstanding' && record.achievementType === 'competition') {
    return `For achieving ${record.positionOrAward.trim()} in ${record.competitionOrEvent.trim()}, demonstrating exceptional merit and bringing distinction to the Department of Computer Science & Engineering.`;
  }
  if (record.awardCategory === 'outstanding') {
    return `For an extraordinary achievement in ${record.achievementArea.trim()}, bringing pride and distinction to the Department of Computer Science & Engineering.`;
  }
  const mapping = getCustomAwardMapping(record.awardCategory, settings);
  const template = record.customCategoryTemplate?.trim() || mapping?.citationTemplate.trim() || '';
  return renderCustomTemplate(template, record);
}

export function formatCertificateNumber(
  prefix: string,
  semester: Semester,
  year: string | number,
  serial: number,
): string {
  const safePrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CSE';
  return `${safePrefix}/${TERM_CODES[semester]}-${year}/${String(serial).padStart(3, '0')}`;
}

export function parseCertificateNumber(value: string) {
  const match = /^([A-Z0-9]+)\/(SPR|SUM|FAL)-(\d{4})\/(\d{3,})$/.exec(value.trim().toUpperCase());
  if (!match) return null;
  return {
    prefix: match[1],
    term: match[2],
    year: match[3],
    serial: Number(match[4]),
  };
}

const commonSchema = z.object({
  recipientName: z.string().trim().min(1, 'Recipient name is required.').max(140, 'Recipient name is too long.'),
  awardYear: z.string().regex(/^\d{4}$/, 'Award year must contain four digits.'),
  issueDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Issue date is invalid.'),
  certificateNumber: z.string().min(1, 'Certificate number is required.'),
});

export function validateRecord(record: CertificateRecord, settings = DEFAULT_SETTINGS): string[] {
  const errors: string[] = [];
  if (!normalizeTemplateId(record.templateId)) errors.push('Certificate template is not recognized.');
  const common = commonSchema.safeParse(record);
  if (!common.success) errors.push(...common.error.issues.map((issue) => issue.message));
  if (record.certificateNumber && !parseCertificateNumber(record.certificateNumber)) {
    errors.push('Certificate number must follow CSE/SPR-2025/001 format.');
  }
  if (record.awardCategory === 'academic' && !record.batch.trim()) {
    errors.push('Batch is required for Academic Excellence.');
  }
  if (record.awardCategory === 'research') {
    if (!record.articleTitle.trim() && !record.customCitation.trim()) errors.push('Article title is required for Research Excellence.');
    if (!record.journalName.trim() && !record.customCitation.trim()) errors.push('Journal name is required for Research Excellence.');
    if (!record.q1Verified) errors.push('Confirm the journal Q1 status before generation.');
  }
  if (record.awardCategory === 'outstanding' && !record.customCitation.trim()) {
    if (record.achievementType === 'competition') {
      if (!record.positionOrAward.trim()) errors.push('Position or award is required.');
      if (!record.competitionOrEvent.trim()) errors.push('Competition or event is required.');
    } else if (!record.achievementArea.trim()) {
      errors.push('Achievement area is required.');
    }
  }
  if (isCustomCategory(record.awardCategory) && !record.customCitation.trim()) {
    const mapping = getCustomAwardMapping(record.awardCategory, settings);
    const template = record.customCategoryTemplate?.trim() || mapping?.citationTemplate.trim() || '';
    if (!record.customCategoryLabel?.trim() && !mapping?.label.trim()) errors.push('Custom award category name is missing.');
    if (!template) errors.push('Custom award citation template is missing.');
    if (template.includes('{{ACHIEVEMENT_AREA}}') && !record.achievementArea.trim()) {
      errors.push('Achievement details are required for this custom award.');
    }
    if (template.includes('{{BATCH}}') && !record.batch.trim()) {
      errors.push('Batch is required for this custom award.');
    }
  }
  const citation = generateCitation(record, settings);
  if (!citation.trim()) errors.push('Achievement citation is required.');
  if (citation.length > 380) errors.push('Achievement citation is too long for the certificate.');
  if (/\{\{|\}\}|placeholder|enter name/i.test(`${record.recipientName} ${citation}`)) {
    errors.push('Remove placeholder text before generating the certificate.');
  }
  return [...new Set(errors)];
}

export function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function safeFilename(record: CertificateRecord): string {
  const number = record.certificateNumber.replace(/[\\/:*?"<>|]+/g, '_');
  const name = record.recipientName.trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
  return `${number}_${name || 'Recipient'}.pdf`;
}

export function containsBengali(value: string): boolean {
  return /[\u0980-\u09ff]/.test(value);
}
