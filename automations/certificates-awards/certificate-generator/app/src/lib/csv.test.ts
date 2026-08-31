import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './certificate';
import { parseBulkCsv, sampleCsv } from './csv';

describe('bulk CSV import', () => {
  it('parses a mixed-category template and allocates shared serial numbers', () => {
    const result = parseBulkCsv(sampleCsv(), DEFAULT_SETTINGS, []);
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((row) => row.errors.length === 0)).toBe(true);
    expect(result.rows.map((row) => row.record.templateId)).toEqual(['pub-classic', 'modern-vintage', 'pub-classic']);
    expect(result.rows.map((row) => row.record.certificateNumber)).toEqual([
      'CSE/SPR-2026/001',
      'CSE/SPR-2026/002',
      'CSE/SPR-2026/003',
    ]);
  });

  it('accepts quoted commas and reports ambiguous categories', () => {
    const csv = [
      'recipient_name,award_category,batch,semester,award_year,issue_date,certificate_number',
      '"Rahim, Ahmed",Unknown,12,Spring,2026,2026-08-30,CSE/SPR-2026/001',
    ].join('\n');
    const result = parseBulkCsv(csv, DEFAULT_SETTINGS, []);
    expect(result.rows[0].record.recipientName).toBe('Rahim, Ahmed');
    expect(result.rows[0].errors).toContain('Award category is not recognized.');
  });

  it('imports custom award aliases from settings', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      customAwardMappings: [{
        id: 'custom:innovation' as const,
        label: 'Innovation Excellence Award',
        aliases: ['IE'],
        citationTemplate: 'For outstanding innovation in {{ACHIEVEMENT_AREA}}.',
      }],
    };
    const csv = [
      'recipient_name,award_category,achievement_area,semester,award_year,issue_date,certificate_number',
      'Sadia Rahman,IE,assistive computing,Spring,2026,2026-08-30,CSE/SPR-2026/001',
    ].join('\n');
    const result = parseBulkCsv(csv, settings, []);
    expect(result.rows[0].record.awardCategory).toBe('custom:innovation');
    expect(result.rows[0].record.customCategoryLabel).toBe('Innovation Excellence Award');
    expect(result.rows[0].errors).toEqual([]);
  });
});
