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
  removeLegacyCourseCoordinationMappings,
  validateRecord,
} from './certificate';

describe('certificate conventions', () => {
  it('uses PUB Classic Blue as the official default template', () => {
    expect(DEFAULT_SETTINGS.defaultTemplateId).toBe('pub-classic');
    expect(emptyRecord(DEFAULT_SETTINGS).templateId).toBe('pub-classic');
  });

  it('ships Course Coordination as a permanent built-in award', () => {
    expect(DEFAULT_SETTINGS.customAwardMappings).toEqual([]);
    expect(normalizeCategory('Course Coordinator')).toBe('coordination');
    expect(normalizeCategory('CCEA')).toBe('coordination');
    const record = {
      ...emptyRecord(DEFAULT_SETTINGS),
      recipientName: 'Dr. Ayesha Rahman',
      awardCategory: 'coordination' as const,
      awardYear: '2026',
      certificateNumber: 'CSE/SUM-2026/001',
      coordinationPeriod: 'Spring 2025 – Summer 2026',
    };
    expect(generateCitation(record)).toContain('Course Coordinator');
    expect(generateCitation(record)).toContain('Spring 2025 – Summer 2026');
    expect(validateRecord(record)).toEqual([]);
  });

  it('migrates the former Course Coordinator mapping and records', () => {
    const legacyMapping = {
      id: 'custom:course-coordination' as const,
      label: 'Course Coordination Excellence Award',
      aliases: ['CCEA', 'Course Coordinator'],
      description: '',
      enabled: true,
      fields: [],
      citationTemplate: '',
    };
    expect(removeLegacyCourseCoordinationMappings([legacyMapping])).toEqual([]);
    const migrated = normalizeCertificateRecord({
      ...emptyRecord(DEFAULT_SETTINGS),
      awardCategory: 'custom:course-coordination',
      customFields: { coordination_period: 'Spring 2025 – Summer 2026' },
    });
    expect(migrated.awardCategory).toBe('coordination');
    expect(migrated.coordinationPeriod).toBe('Spring 2025 – Summer 2026');
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
    expect(generateCitation(record)).toContain('First Position among all students enrolled in the 4th Semester');
    expect(generateCitation(record)).toContain('Spring 2025 academic term');
  });

  it('uses concise standalone wording for every official award', () => {
    const base = {
      ...emptyRecord(DEFAULT_SETTINGS),
      recipientName: 'Approved Recipient',
      awardYear: '2026',
      certificateNumber: 'CSE/SPR-2026/001',
    };
    const citations = [
      generateCitation({ ...base, studySemester: '1st Semester' }),
      generateCitation({ ...base, awardCategory: 'research', articleTitle: 'Responsible Computing', journalName: 'Journal of Computing', q1Verified: true }),
      generateCitation({ ...base, awardCategory: 'outstanding', achievementType: 'competition', positionOrAward: 'First Place', competitionOrEvent: 'National Photography Competition' }),
      generateCitation({ ...base, awardCategory: 'outstanding', achievementType: 'general', achievementArea: 'community technology leadership' }),
      generateCitation({ ...base, awardCategory: 'coordination', coordinationPeriod: 'Spring 2025 – Summer 2026' }),
    ];
    citations.forEach((citation) => {
      expect(citation).toMatch(/^In recognition of /);
      expect(citation.length).toBeLessThanOrEqual(260);
      expect((citation.match(/in recognition/gi) ?? [])).toHaveLength(1);
    });
    expect(citations[0]).toContain('students enrolled in the 1st Semester');
    expect(citations[1]).toContain('a Q1-ranked journal');
    expect(citations[2]).toContain('First Place at National Photography Competition');
    expect(citations[3]).toContain('bringing distinction to the Department');
    expect(citations[4]).toContain('completing the appointment as Course Coordinator');
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

  it('blocks placeholder text and supports ranked or unranked research publications', () => {
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
    expect(validateRecord(research)).toEqual([]);
    expect(generateCitation(research)).not.toContain('Q1');
    expect(generateCitation({ ...research, q1Verified: true })).toContain('a Q1-ranked journal');
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
