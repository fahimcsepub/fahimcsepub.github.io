import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  emptyRecord,
  formatCertificateNumber,
  generateCitation,
  normalizeCategory,
  normalizeSemester,
  normalizeTemplateId,
  parseCertificateNumber,
  validateRecord,
} from './certificate';

describe('certificate conventions', () => {
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
    expect(normalizeTemplateId('PUST Classic Blue')).toBe('pust-classic');
    expect(normalizeTemplateId('Modern Vintage')).toBe('modern-vintage');
  });

  it('creates the approved academic citation', () => {
    const record = {
      ...emptyRecord(DEFAULT_SETTINGS),
      batch: '12',
      awardYear: '2025',
      certificateNumber: 'CSE/SPR-2025/001',
    };
    expect(generateCitation(record)).toContain('First Position among the students of Batch 12');
    expect(generateCitation(record)).toContain('Spring 2025 Semester');
  });

  it('blocks placeholder text and missing Q1 verification', () => {
    const placeholder = {
      ...emptyRecord(DEFAULT_SETTINGS),
      recipientName: '{{RECIPIENT_NAME}}',
      batch: '12',
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
        citationTemplate: 'For outstanding innovation in {{ACHIEVEMENT_AREA}} during {{SEMESTER}} {{YEAR}}.',
      }],
    };
    expect(normalizeCategory('IE', settings)).toBe('custom:innovation');
    const record = {
      ...emptyRecord(settings),
      awardCategory: 'custom:innovation' as const,
      recipientName: 'Sadia Rahman',
      achievementArea: 'assistive computing',
      awardYear: '2026',
      certificateNumber: 'CSE/SPR-2026/001',
      customCategoryLabel: 'Innovation Excellence Award',
      customCategoryTemplate: settings.customAwardMappings[0].citationTemplate,
    };
    expect(generateCitation(record, settings)).toBe('For outstanding innovation in assistive computing during Spring 2026.');
    expect(validateRecord(record, settings)).toEqual([]);
  });
});
