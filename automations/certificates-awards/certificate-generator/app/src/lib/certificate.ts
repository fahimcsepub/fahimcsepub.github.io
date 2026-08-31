import { z } from 'zod';
import type {
  AcademicRankingScope,
  AwardCategory,
  BuiltInAwardCategory,
  CertificateTemplateId,
  CertificateRecord,
  CitationMode,
  CustomAwardField,
  CustomAwardFieldType,
  CustomAwardMapping,
  GeneratorSettings,
  Semester,
} from '../types';

export const CATEGORY_LABELS: Record<BuiltInAwardCategory, string> = {
  academic: 'Academic Excellence Award',
  research: 'Research Excellence Award',
  outstanding: 'Outstanding Achievement Award',
  coordination: 'Course Coordination Excellence Award',
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

export const COURSE_COORDINATION_CITATION = 'In recognition of dedicated service and academic leadership upon completing the appointment as Course Coordinator of the Department of Computer Science & Engineering for the period {{COORDINATION_PERIOD}}.';

export function removeLegacyCourseCoordinationMappings(mappings: CustomAwardMapping[]): CustomAwardMapping[] {
  const officialLabel = CATEGORY_LABELS.coordination.toLowerCase();
  return mappings.filter((mapping) => (
    mapping.id !== 'custom:course-coordination'
    && mapping.label.trim().toLowerCase() !== officialLabel
    && !mapping.aliases.some((alias) => ['ccea', 'course coordinator'].includes(alias.trim().toLowerCase()))
  ));
}

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
  '{{AWARD_CATEGORY}}',
  '{{ACHIEVEMENT_AREA}}',
  '{{BATCH}}',
  '{{STUDY_SEMESTER}}',
  '{{RANKING_GROUP}}',
  '{{TERM}}',
  '{{SEMESTER}}',
  '{{YEAR}}',
  '{{ARTICLE_TITLE}}',
  '{{JOURNAL_NAME}}',
  '{{POSITION_OR_AWARD}}',
  '{{COMPETITION_OR_EVENT}}',
  '{{COORDINATION_PERIOD}}',
  '{{ISSUE_DATE}}',
] as const;

const CUSTOM_FIELD_TYPES: CustomAwardFieldType[] = ['text', 'textarea', 'number', 'date', 'select'];
const ACADEMIC_SCOPES: AcademicRankingScope[] = ['semester', 'batch', 'custom'];
const CITATION_MODES: CitationMode[] = ['automatic', 'custom'];

export function normalizeCustomFieldKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function customFieldToken(key: string): string {
  return `{{${normalizeCustomFieldKey(key).toUpperCase()}}}`;
}

function normalizeCustomAwardField(value: Partial<CustomAwardField> | undefined, index: number): CustomAwardField {
  const type = CUSTOM_FIELD_TYPES.includes(value?.type as CustomAwardFieldType) ? value?.type as CustomAwardFieldType : 'text';
  const key = normalizeCustomFieldKey(value?.key ?? '') || `field_${index + 1}`;
  return {
    key,
    label: value?.label?.trim() || `Field ${index + 1}`,
    type,
    required: value?.required !== false,
    placeholder: value?.placeholder ?? '',
    helpText: value?.helpText ?? '',
    options: Array.isArray(value?.options) ? value.options.map((option) => String(option).trim()).filter(Boolean) : [],
  };
}

export function normalizeCustomAwardMappings(value: unknown): CustomAwardMapping[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate, mappingIndex) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const mapping = candidate as Partial<CustomAwardMapping>;
    const rawId = typeof mapping.id === 'string' ? mapping.id : '';
    const id = (rawId.startsWith('custom:') ? rawId : `custom:migrated-${mappingIndex + 1}`) as `custom:${string}`;
    const fields = Array.isArray(mapping.fields)
      ? mapping.fields.map((field, fieldIndex) => normalizeCustomAwardField(field, fieldIndex))
      : [];
    return [{
      id,
      label: typeof mapping.label === 'string' ? mapping.label : `Custom Award ${mappingIndex + 1}`,
      aliases: Array.isArray(mapping.aliases) ? mapping.aliases.map(String).map((alias) => alias.trim()).filter(Boolean) : [],
      description: typeof mapping.description === 'string' ? mapping.description : '',
      enabled: mapping.enabled !== false,
      fields,
      citationTemplate: typeof mapping.citationTemplate === 'string' ? mapping.citationTemplate : '',
    }];
  });
}

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
    academicScope: 'semester',
    studySemester: '',
    rankingGroup: '',
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
    coordinationPeriod: '',
    citationMode: 'automatic',
    customCitation: '',
    customFields: {},
    customCategoryLabel: '',
    customCategoryTemplate: '',
    customCategoryFields: [],
    signatureMode: settings.defaultSignatureMode,
    signatureLayout: settings.defaultSignatureLayout,
  };
}

export function normalizeCertificateRecord(
  value: Partial<CertificateRecord>,
  settings = DEFAULT_SETTINGS,
): CertificateRecord {
  const defaults = emptyRecord(settings);
  const customCitation = typeof value.customCitation === 'string' ? value.customCitation : '';
  const inferredScope: AcademicRankingScope = value.batch?.trim() ? 'batch' : 'semester';
  const academicScope = ACADEMIC_SCOPES.includes(value.academicScope as AcademicRankingScope)
    ? value.academicScope as AcademicRankingScope
    : inferredScope;
  const citationMode = CITATION_MODES.includes(value.citationMode as CitationMode)
    ? value.citationMode as CitationMode
    : customCitation.trim() ? 'custom' : 'automatic';
  const customFields = value.customFields && typeof value.customFields === 'object' && !Array.isArray(value.customFields)
    ? Object.fromEntries(Object.entries(value.customFields).map(([key, fieldValue]) => [normalizeCustomFieldKey(key), String(fieldValue ?? '')]))
    : {};
  const legacyCourseCoordination = value.awardCategory === 'custom:course-coordination'
    || value.customCategoryLabel?.trim().toLowerCase() === CATEGORY_LABELS.coordination.toLowerCase();
  const awardCategory = legacyCourseCoordination ? 'coordination' : value.awardCategory ?? defaults.awardCategory;
  const coordinationPeriod = typeof value.coordinationPeriod === 'string' && value.coordinationPeriod.trim()
    ? value.coordinationPeriod
    : (awardCategory === 'coordination' ? customFields.coordination_period ?? '' : '');
  return {
    ...defaults,
    ...value,
    templateId: normalizeTemplateId(value.templateId) ?? defaults.templateId,
    awardCategory,
    academicScope,
    studySemester: typeof value.studySemester === 'string' ? value.studySemester : '',
    rankingGroup: typeof value.rankingGroup === 'string' ? value.rankingGroup : '',
    citationMode,
    customCitation,
    customFields,
    coordinationPeriod,
    customCategoryFields: Array.isArray(value.customCategoryFields)
      ? value.customCategoryFields.map((field, index) => normalizeCustomAwardField(field, index))
      : [],
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
  if (['cc', 'ccea', 'course coordinator', 'course coordination', 'course coordinator award', 'course coordination excellence', 'course coordination excellence award'].includes(normalized)) return 'coordination';
  const customMatches = settings.customAwardMappings.filter((mapping) => mapping.enabled !== false).filter((mapping) => {
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
    { id: 'coordination', label: CATEGORY_LABELS.coordination },
    ...settings.customAwardMappings.filter((mapping) => mapping.enabled !== false).map((mapping) => ({ id: mapping.id, label: mapping.label })),
  ];
}

export function getCustomFieldsForRecord(record: CertificateRecord, settings = DEFAULT_SETTINGS): CustomAwardField[] {
  if (record.customCategoryFields?.length) return record.customCategoryFields;
  return getCustomAwardMapping(record.awardCategory, settings)?.fields ?? [];
}

function citationTokenValues(record: CertificateRecord, settings: GeneratorSettings): Record<string, string> {
  const values: Record<string, string> = {
    RECIPIENT_NAME: record.recipientName.trim(),
    AWARD_CATEGORY: getCategoryLabel(record, settings),
    ACHIEVEMENT_AREA: record.achievementArea.trim(),
    BATCH: record.batch.trim(),
    STUDY_SEMESTER: record.studySemester.trim(),
    RANKING_GROUP: record.rankingGroup.trim(),
    TERM: record.semester,
    SEMESTER: record.semester,
    YEAR: record.awardYear.trim(),
    ARTICLE_TITLE: record.articleTitle.trim(),
    JOURNAL_NAME: record.journalName.trim(),
    POSITION_OR_AWARD: record.positionOrAward.trim(),
    COMPETITION_OR_EVENT: record.competitionOrEvent.trim(),
    COORDINATION_PERIOD: record.coordinationPeriod.trim(),
    ISSUE_DATE: formatDisplayDate(record.issueDate),
  };
  Object.entries(record.customFields ?? {}).forEach(([key, value]) => {
    values[normalizeCustomFieldKey(key).toUpperCase()] = value.trim();
  });
  return values;
}

export function getTemplateTokens(template: string): string[] {
  return [...template.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)].map((match) => match[1].toUpperCase());
}

export function renderCitationTemplate(template: string, record: CertificateRecord, settings = DEFAULT_SETTINGS): string {
  const values = citationTokenValues(record, settings);
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, rawToken: string) => {
    const token = rawToken.toUpperCase();
    return Object.hasOwn(values, token) ? values[token] : match;
  }).trim();
}

export function usesCustomCitation(record: CertificateRecord): boolean {
  return record.citationMode === 'custom';
}

export function generateCitation(record: CertificateRecord, settings = DEFAULT_SETTINGS): string {
  if (usesCustomCitation(record)) return record.customCitation.trim();
  if (record.awardCategory === 'academic') {
    if (record.academicScope === 'batch') {
      return `In recognition of securing First Position among the students of ${record.batch.trim()} during the ${record.semester} ${record.awardYear.trim()} academic term.`;
    }
    if (record.academicScope === 'custom') {
      return `In recognition of securing First Position among ${record.rankingGroup.trim()} during the ${record.semester} ${record.awardYear.trim()} academic term.`;
    }
    return `In recognition of securing First Position among all students enrolled in the ${record.studySemester.trim()} during the ${record.semester} ${record.awardYear.trim()} academic term.`;
  }
  if (record.awardCategory === 'research') {
    const ranking = record.q1Verified ? ', a Q1-ranked journal' : '';
    return `In recognition of the publication of the research article “${record.articleTitle.trim()}” in ${record.journalName.trim()}${ranking}.`;
  }
  if (record.awardCategory === 'outstanding' && record.achievementType === 'competition') {
    return `In recognition of achieving ${record.positionOrAward.trim()} at ${record.competitionOrEvent.trim()}, demonstrating exceptional merit and bringing distinction to the Department of Computer Science & Engineering.`;
  }
  if (record.awardCategory === 'outstanding') {
    return `In recognition of an extraordinary achievement in ${record.achievementArea.trim()}, bringing distinction to the Department of Computer Science & Engineering.`;
  }
  if (record.awardCategory === 'coordination') {
    return renderCitationTemplate(COURSE_COORDINATION_CITATION, record, settings);
  }
  const mapping = getCustomAwardMapping(record.awardCategory, settings);
  const template = record.customCategoryTemplate?.trim() || mapping?.citationTemplate.trim() || '';
  return renderCitationTemplate(template, record, settings);
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
  const customMode = usesCustomCitation(record);
  if (!normalizeTemplateId(record.templateId)) errors.push('Certificate template is not recognized.');
  const common = commonSchema.safeParse(record);
  if (!common.success) errors.push(...common.error.issues.map((issue) => issue.message));
  if (record.certificateNumber && !parseCertificateNumber(record.certificateNumber)) {
    errors.push('Certificate number must follow CSE/SPR-2025/001 format.');
  }
  if (customMode && !record.customCitation.trim()) {
    errors.push('Enter the custom achievement citation or switch to automatic wording.');
  }
  if (record.awardCategory === 'academic' && !customMode) {
    if (record.academicScope === 'semester' && !record.studySemester.trim()) {
      errors.push('Academic semester is required for Academic Excellence.');
    }
    if (record.academicScope === 'batch' && !record.batch.trim()) {
      errors.push('Batch is required for the selected Academic Excellence scope.');
    }
    if (record.academicScope === 'custom' && !record.rankingGroup.trim()) {
      errors.push('Student group is required for the custom Academic Excellence scope.');
    }
  }
  if (record.awardCategory === 'research') {
    if (!record.articleTitle.trim() && !customMode) errors.push('Article title is required for Research Excellence.');
    if (!record.journalName.trim() && !customMode) errors.push('Journal name is required for Research Excellence.');
  }
  if (record.awardCategory === 'outstanding' && !customMode) {
    if (record.achievementType === 'competition') {
      if (!record.positionOrAward.trim()) errors.push('Position or award is required.');
      if (!record.competitionOrEvent.trim()) errors.push('Competition or event is required.');
    } else if (!record.achievementArea.trim()) {
      errors.push('Achievement area is required.');
    }
  }
  if (record.awardCategory === 'coordination' && !customMode && !record.coordinationPeriod.trim()) {
    errors.push('Coordination period is required for Course Coordination Excellence.');
  }
  if (isCustomCategory(record.awardCategory) && !customMode) {
    const mapping = getCustomAwardMapping(record.awardCategory, settings);
    const template = record.customCategoryTemplate?.trim() || mapping?.citationTemplate.trim() || '';
    const fields = getCustomFieldsForRecord(record, settings);
    if (!record.customCategoryLabel?.trim() && !mapping?.label.trim()) errors.push('Custom award category name is missing.');
    if (!template) errors.push('Custom award citation template is missing.');
    fields.filter((field) => field.required).forEach((field) => {
      if (!record.customFields?.[field.key]?.trim()) errors.push(`${field.label} is required for this custom award.`);
    });
    const standardTokens = new Set(CUSTOM_TEMPLATE_TOKENS.map((token) => token.slice(2, -2)));
    const customTokens = new Set(fields.map((field) => normalizeCustomFieldKey(field.key).toUpperCase()));
    const unknownTokens = getTemplateTokens(template).filter((token) => !standardTokens.has(token) && !customTokens.has(token));
    unknownTokens.forEach((token) => errors.push(`Citation template field {{${token}}} is not defined.`));
    const values = citationTokenValues(record, settings);
    getTemplateTokens(template).forEach((token) => {
      if ((standardTokens.has(token) || customTokens.has(token)) && !values[token]?.trim()) {
        const matchingField = fields.find((field) => normalizeCustomFieldKey(field.key).toUpperCase() === token);
        errors.push(`${matchingField?.label ?? token.replace(/_/g, ' ').toLowerCase()} is required by the citation template.`);
      }
    });
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
