import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  emptyRecord,
  formatCertificateNumber,
  generateCitation,
  normalizeCertificateRecord,
  normalizeCategory,
  normalizeSemester,
  normalizeTemplateId,
  parseCertificateNumber,
  validateRecord,
} from './certificate';

describe('certificate conventions', () => {
  it('uses PUB Classic Blue as the official default template', () => {
    expect(DEFAULT_SETTINGS.defaultTemplateId).toBe('pub-classic');
    expect(emptyRecord(DEFAULT_SETTINGS).templateId).toBe('pub-classic');
  });

  it('uses term-based numbering without award abbreviations', () => {
    expect(formatCertificateNumber('CSE', 'Spring', 2025, 1)).toBe('CSE/SPR-2025/001');
    expect(formatCertificateNumber('CSE', 'Summer', 2025, 12)).toBe('CSE/SUM-2025/012');
    expect(formatCertificateNumber('CSE', 'Fall', 2025, 1000)).toBe('CSE/FAL-2025/1000');
  });

  it('parses and normalizes expected legacy values', () => {
    expect(normalizeCategory('AE')).toBe('academic');
    expect(normalizeCategory('Research Excellence Award')).toBe('research');
    expect(normalizeCategory('OA')).toBe('outstanding');
    expect(normalizeSemester('Autumn')).toBe('Fall');
    expect(parseCertificateNumber('CSE/SPR-2025/001')?.serial).toBe(1);
    expect(normalizeTemplateId('PUB Classic Blue')).toBe('pub-classic');
    expect(normalizeTemplateId('PUST Classic Blue')).toBe('pub-classic');
    expect(normalizeTemplateId('Modern Vintage')).toBe('modern-vintage');
  });

  it('creates the approved academic citation', () => {
    const record = {
      ...emptyRecord(DEFAULT_SETTINGS),
      studySemester: '4th Semester',
      awardYear: '2025',
      certificateNumber: 'CSE/SPR-2025/001',
    };
    expect(generateCitation(record)).toContain('First Position among all students of the 4th Semester');
    expect(generateCitation(record)).toContain('Spring 2025 academic term');
  });

  it('supports semester, batch, and custom Academic Excellence scopes', () => {
    const base = { ...emptyRecord(DEFAULT_SETTINGS), recipientName: 'Approved Student', awardYear: '2026', certificateNumber: 'CSE/SPR-2026/001' };
    expect(validateRecord({ ...base, studySemester: '6th Semester' })).toEqual([]);
    expect(generateCitation({ ...base, academicScope: 'batch', batch: 'Diploma Batch 8' })).toContain('students of Diploma Batch 8');
    expect(generateCitation({ ...base, academicScope: 'custom', rankingGroup: 'all graduating students' })).toContain('among all graduating students');
  });

  it('migrates old batch records and explicit custom citations safely', () => {
    const migrated = normalizeCertificateRecord({
      ...emptyRecord(DEFAULT_SETTINGS),
      academicScope: undefined,
      citationMode: undefined,
      batch: '12',
      customCitation: 'Approved historical wording.',
    });
    expect(migrated.academicScope).toBe('batch');
    expect(migrated.citationMode).toBe('custom');
    expect(generateCitation(migrated)).toBe('Approved historical wording.');
  });

  it('blocks placeholder text and missing Q1 verification', () => {
    const placeholder = {
      ...emptyRecord(DEFAULT_SETTINGS),
      recipientName: '{{RECIPIENT_NAME}}',
      studySemester: '4th Semester',
      certificateNumber: 'CSE/SPR-2026/001',
    };
    expect(validateRecord(placeholder).some((error) => error.includes('placeholder'))).toBe(true);

    const research = {
      ...placeholder,
      recipientName: 'Nusrat Jahan',
      awardCategory: 'research' as const,
      articleTitle: 'A verified paper',
      journalName: 'Journal of Examples',
    };
    expect(validateRecord(research)).toContain('Confirm the journal Q1 status before generation.');
  });

  it('supports reusable custom award mappings and CSV aliases', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      customAwardMappings: [{
        id: 'custom:innovation' as const,
        label: 'Innovation Excellence Award',
        aliases: ['IE', 'Innovation'],
        description: 'Recognizes applied innovation.',
        enabled: true,
        fields: [{ key: 'innovation_area', label: 'Innovation area', type: 'text' as const, required: true, placeholder: '', helpText: '', options: [] }],
        citationTemplate: 'For outstanding innovation in {{INNOVATION_AREA}} during {{TERM}} {{YEAR}}.',
      }],
    };
    expect(normalizeCategory('IE', settings)).toBe('custom:innovation');
    const record = {
      ...emptyRecord(settings),
      awardCategory: 'custom:innovation' as const,
      recipientName: 'Sadia Rahman',
      customFields: { innovation_area: 'assistive computing' },
      awardYear: '2026',
      certificateNumber: 'CSE/SPR-2026/001',
      customCategoryLabel: 'Innovation Excellence Award',
      customCategoryTemplate: settings.customAwardMappings[0].citationTemplate,
      customCategoryFields: settings.customAwardMappings[0].fields,
    };
    expect(generateCitation(record, settings)).toBe('For outstanding innovation in assistive computing during Spring 2026.');
    expect(validateRecord(record, settings)).toEqual([]);
  });
});
