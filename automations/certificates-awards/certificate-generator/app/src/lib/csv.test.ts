import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './certificate';
import { parseBulkCsv, parseRegisterCsv, registerCsv, rowsToRegisterEntries, sampleCsv } from './csv';

describe('bulk CSV import', () => {
  it('parses a mixed-category template and allocates shared serial numbers', () => {
    const result = parseBulkCsv(sampleCsv(), DEFAULT_SETTINGS, []);
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((row) => row.errors.length === 0)).toBe(true);
    expect(result.rows.map((row) => row.record.templateId)).toEqual(['pub-classic', 'modern-vintage', 'pub-classic']);
    expect(result.rows[0].record.academicScope).toBe('semester');
    expect(result.rows[0].record.studySemester).toBe('4th Semester');
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
        description: 'Recognizes innovation.',
        enabled: true,
        fields: [{ key: 'project_title', label: 'Project title', type: 'text' as const, required: true, placeholder: '', helpText: '', options: [] }],
        citationTemplate: 'For outstanding innovation through {{PROJECT_TITLE}}.',
      }],
    };
    const csv = [
      'recipient_name,award_category,field_project_title,semester,award_year,issue_date,certificate_number',
      'Sadia Rahman,IE,Assistive Computing Platform,Spring,2026,2026-08-30,CSE/SPR-2026/001',
    ].join('\n');
    const result = parseBulkCsv(csv, settings, []);
    expect(result.rows[0].record.awardCategory).toBe('custom:innovation');
    expect(result.rows[0].record.customCategoryLabel).toBe('Innovation Excellence Award');
    expect(result.rows[0].record.customFields.project_title).toBe('Assistive Computing Platform');
    expect(result.rows[0].errors).toEqual([]);
  });

  it('keeps legacy batch CSV rows valid and infers custom citation mode', () => {
    const csv = [
      'recipient_name,award_category,batch,semester,award_year,issue_date,certificate_number,custom_citation',
      'Legacy Student,AE,HSC Batch 10,Spring,2025,2025-05-01,CSE/SPR-2025/010,Approved historical citation.',
    ].join('\n');
    const result = parseBulkCsv(csv, DEFAULT_SETTINGS, []);
    expect(result.rows[0].record.academicScope).toBe('batch');
    expect(result.rows[0].record.citationMode).toBe('custom');
    expect(result.rows[0].errors).toEqual([]);
  });

  it('exports and restores custom field values and mapping snapshots', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      customAwardMappings: [{
        id: 'custom:service' as const,
        label: 'Service Excellence Award',
        aliases: ['SE'],
        description: 'Recognizes department service.',
        enabled: true,
        fields: [{ key: 'service_area', label: 'Service area', type: 'text' as const, required: true, placeholder: '', helpText: '', options: [] }],
        citationTemplate: 'For exceptional service in {{SERVICE_AREA}}.',
      }],
    };
    const imported = parseBulkCsv([
      'recipient_name,award_category,field_service_area,semester,award_year,issue_date,certificate_number',
      'Samiha Noor,SE,Student mentoring,Summer,2026,2026-08-31,CSE/SUM-2026/001',
    ].join('\n'), settings, []);
    const exported = registerCsv(rowsToRegisterEntries(imported.rows, settings), settings);
    expect(exported).toContain('field_service_area');
    const restored = parseRegisterCsv(exported, { ...settings, customAwardMappings: [] });
    expect(restored.errors).toEqual([]);
    expect(restored.entries[0].customFields.service_area).toBe('Student mentoring');
    expect(restored.entries[0].customCategoryFields?.[0].label).toBe('Service area');
  });
});
