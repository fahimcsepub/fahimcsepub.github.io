import { Check, Download, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  CertificateRecord,
  CustomAwardField,
  GeneratorSettings,
  RegisterEntry,
  SessionSignatures,
} from '../types';
import {
  CERTIFICATE_TEMPLATES,
  TERM_CODES,
  emptyRecord,
  formatCertificateNumber,
  generateCitation,
  getAwardOptions,
  getCategoryLabel,
  getCustomAwardMapping,
  getCustomFieldsForRecord,
  isCustomCategory,
  safeFilename,
  validateRecord,
} from '../lib/certificate';
import { downloadBlob } from '../lib/download';
import { nextSerial } from '../lib/register';
import { CertificatePreview } from './CertificatePreview';
import { Button } from './ui/Button';
import { Field, Input, Select, Textarea } from './ui/Field';

export function GeneratePanel({
  record,
  setRecord,
  settings,
  signatures,
  register,
  editingNumber,
  onGenerated,
  onReset,
}: {
  record: CertificateRecord;
  setRecord: (record: CertificateRecord) => void;
  settings: GeneratorSettings;
  signatures: SessionSignatures;
  register: RegisterEntry[];
  editingNumber?: string;
  onGenerated: (entry: RegisterEntry, reprint: boolean) => Promise<void>;
  onReset: () => void;
}) {
  const [manualNumber, setManualNumber] = useState(Boolean(editingNumber));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [attempted, setAttempted] = useState(false);

  const update = <K extends keyof CertificateRecord>(key: K, value: CertificateRecord[K]) => {
    setRecord({ ...record, [key]: value });
    setMessage(undefined);
  };

  useEffect(() => {
    setManualNumber(Boolean(editingNumber));
  }, [editingNumber]);

  useEffect(() => {
    if (manualNumber || editingNumber || !/^\d{4}$/.test(record.awardYear)) return;
    const serial = nextSerial(register, TERM_CODES[record.semester], record.awardYear);
    const number = formatCertificateNumber(settings.numberPrefix, record.semester, record.awardYear, serial);
    if (record.certificateNumber !== number) setRecord({ ...record, certificateNumber: number });
  }, [editingNumber, manualNumber, record, register, setRecord, settings.numberPrefix]);

  const duplicate = register.some(
    (entry) => entry.certificateNumber.toUpperCase() === record.certificateNumber.toUpperCase()
      && entry.certificateNumber !== editingNumber,
  );
  const errors = useMemo(() => {
    const current = validateRecord(record, settings);
    if (duplicate) current.push('Certificate number already exists in the issuance register.');
    return [...new Set(current)];
  }, [duplicate, record, settings]);
  const automaticCitation = useMemo(() => generateCitation({ ...record, citationMode: 'automatic', customCitation: '' }, settings), [record, settings]);
  const customFields = useMemo(() => getCustomFieldsForRecord(record, settings), [record, settings]);
  const awardOptions = useMemo(() => {
    const options = getAwardOptions(settings);
    if (!options.some((option) => option.id === record.awardCategory)) {
      options.push({ id: record.awardCategory, label: getCategoryLabel(record, settings) });
    }
    return options;
  }, [record, settings]);

  function changeAwardCategory(category: CertificateRecord['awardCategory']) {
    const mapping = getCustomAwardMapping(category, settings);
    setRecord({
      ...record,
      awardCategory: category,
      citationMode: 'automatic',
      customCitation: '',
      customFields: Object.fromEntries((mapping?.fields ?? []).map((field) => [field.key, ''])),
      customCategoryLabel: mapping?.label ?? '',
      customCategoryTemplate: mapping?.citationTemplate ?? '',
      customCategoryFields: mapping?.fields ?? [],
    });
    setMessage(undefined);
  }

  function updateCustomField(key: string, value: string) {
    update('customFields', { ...record.customFields, [key]: value });
  }

  function setCitationMode(mode: CertificateRecord['citationMode']) {
    setRecord({
      ...record,
      citationMode: mode,
      customCitation: mode === 'custom' && !record.customCitation.trim() ? automaticCitation : record.customCitation,
    });
    setMessage(undefined);
  }

  async function generate() {
    setAttempted(true);
    setMessage(undefined);
    if (errors.length) return;
    setBusy(true);
    try {
      const { generateCertificatePdf } = await import('../lib/pdf');
      const bytes = await generateCertificatePdf(record, {
        settings,
        signatures,
        assetBaseUrl: new URL('assets/', document.baseURI).href,
      });
      downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), safeFilename(record));
      const now = new Date().toISOString();
      const previous = editingNumber ? register.find((entry) => entry.certificateNumber === editingNumber) : undefined;
      const entry: RegisterEntry = {
        ...record,
        citation: generateCitation(record, settings),
        generatedAt: previous?.generatedAt ?? now,
        lastGeneratedAt: now,
        reprintCount: previous ? previous.reprintCount + 1 : 0,
      };
      await onGenerated(entry, Boolean(previous));
      setMessage(previous ? 'Certificate reprinted with its original number.' : 'Certificate generated and added to the local register.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Certificate generation failed.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    onReset();
    setManualNumber(false);
    setAttempted(false);
    setMessage(undefined);
  }

  return (
    <div className="workspace">
      <section className="editor-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow gold">Single certificate</p>
            <h2>{getCategoryLabel(record, settings)}</h2>
          </div>
          <span className={`step-badge ${errors.length ? '' : 'complete'}`}>{errors.length ? 'Draft' : <><Check size={12} /> Ready</>}</span>
        </div>

        {attempted && errors.length > 0 && (
          <div className="alert alert-error" role="alert">
            <strong>Please review {errors.length} item{errors.length === 1 ? '' : 's'}.</strong>
            <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        )}

        <Field label="Certificate template" hint={CERTIFICATE_TEMPLATES.find((template) => template.id === record.templateId)?.description}>
          <Select value={record.templateId} onChange={(event) => update('templateId', event.target.value as CertificateRecord['templateId'])}>
            {CERTIFICATE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
          </Select>
        </Field>

        <Field label="Award category">
          <Select value={record.awardCategory} onChange={(event) => changeAwardCategory(event.target.value as CertificateRecord['awardCategory'])}>
            {awardOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Select>
        </Field>

        <Field label="Recipient name" hint="Use the official spelling that should appear on the certificate.">
          <Input value={record.recipientName} maxLength={140} onChange={(event) => update('recipientName', event.target.value)} placeholder="e.g. Nusrat Jahan" />
        </Field>

        {record.awardCategory === 'academic' && (
          <div className="dynamic-fields">
            <Field label="Ranking scope" hint="Choose the complete student group among whom First Position was determined.">
              <Select value={record.academicScope} onChange={(event) => update('academicScope', event.target.value as CertificateRecord['academicScope'])}>
                <option value="semester">All students of an academic semester</option>
                <option value="batch">Students of a specific batch</option>
                <option value="custom">A custom student group</option>
              </Select>
            </Field>
            {record.academicScope === 'semester' && (
              <Field label="Academic semester" hint="Use Semester wording, such as 4th Semester. This is separate from the Spring/Summer/Fall result term.">
                <Input list="academic-semesters" value={record.studySemester} onChange={(event) => update('studySemester', event.target.value)} placeholder="e.g. 4th Semester" />
              </Field>
            )}
            {record.academicScope === 'batch' && (
              <Field label="Batch or cohort" hint="Useful only when the approved ranking was limited to one batch.">
                <Input value={record.batch} onChange={(event) => update('batch', event.target.value)} placeholder="e.g. HSC Batch 12" />
              </Field>
            )}
            {record.academicScope === 'custom' && (
              <Field label="Student group" hint="Write the exact group that should appear in the citation.">
                <Input value={record.rankingGroup} onChange={(event) => update('rankingGroup', event.target.value)} placeholder="e.g. all graduating students" />
              </Field>
            )}
            <datalist id="academic-semesters">
              {['1st Semester', '2nd Semester', '3rd Semester', '4th Semester', '5th Semester', '6th Semester', '7th Semester', '8th Semester'].map((value) => <option key={value} value={value} />)}
            </datalist>
          </div>
        )}

        {record.awardCategory === 'research' && (
          <div className="dynamic-fields">
            <Field label="Research article title"><Input value={record.articleTitle} onChange={(event) => update('articleTitle', event.target.value)} /></Field>
            <Field label="Journal name"><Input value={record.journalName} onChange={(event) => update('journalName', event.target.value)} /></Field>
            <div className="field-grid">
              <Field label="DOI" hint="Optional register metadata"><Input value={record.doi} onChange={(event) => update('doi', event.target.value)} /></Field>
              <Field label="Publication URL" hint="Optional register metadata"><Input type="url" value={record.publicationUrl} onChange={(event) => update('publicationUrl', event.target.value)} /></Field>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={record.q1Verified} onChange={(event) => update('q1Verified', event.target.checked)} />
              <span><strong>Q1 status verified</strong><small>I have confirmed the journal quartile for the relevant publication year.</small></span>
            </label>
          </div>
        )}

        {record.awardCategory === 'outstanding' && (
          <div className="dynamic-fields">
            <Field label="Achievement type">
              <Select value={record.achievementType} onChange={(event) => update('achievementType', event.target.value as CertificateRecord['achievementType'])}>
                <option value="competition">Competition or award</option>
                <option value="general">General extraordinary achievement</option>
              </Select>
            </Field>
            {record.achievementType === 'competition' ? (
              <div className="field-grid">
                <Field label="Position or award"><Input value={record.positionOrAward} onChange={(event) => update('positionOrAward', event.target.value)} placeholder="e.g. Champion" /></Field>
                <Field label="Competition or event"><Input value={record.competitionOrEvent} onChange={(event) => update('competitionOrEvent', event.target.value)} /></Field>
              </div>
            ) : (
              <Field label="Achievement area"><Input value={record.achievementArea} onChange={(event) => update('achievementArea', event.target.value)} placeholder="e.g. national innovation leadership" /></Field>
            )}
          </div>
        )}

        {isCustomCategory(record.awardCategory) && (
          <div className="dynamic-fields">
            {customFields.map((field) => (
              <CustomMappingField key={field.key} field={field} value={record.customFields[field.key] ?? ''} onChange={(value) => updateCustomField(field.key, value)} />
            ))}
            {customFields.length === 0 && (record.customCategoryTemplate ?? '').includes('{{ACHIEVEMENT_AREA}}') && (
              <Field label="Achievement details"><Input value={record.achievementArea} onChange={(event) => update('achievementArea', event.target.value)} placeholder="Describe the recognized achievement" /></Field>
            )}
            {customFields.length === 0 && (record.customCategoryTemplate ?? '').includes('{{BATCH}}') && (
              <Field label="Batch"><Input value={record.batch} onChange={(event) => update('batch', event.target.value)} placeholder="e.g. HSC Batch 12" /></Field>
            )}
          </div>
        )}

        <div className="field-grid three">
          <Field label="Result term" hint="Used in the certificate number and award citation.">
            <Select value={record.semester} onChange={(event) => update('semester', event.target.value as CertificateRecord['semester'])}>
              <option>Spring</option><option>Summer</option><option>Fall</option>
            </Select>
          </Field>
          <Field label="Award year"><Input inputMode="numeric" value={record.awardYear} maxLength={4} onChange={(event) => update('awardYear', event.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Issue date"><Input type="date" value={record.issueDate} onChange={(event) => update('issueDate', event.target.value)} /></Field>
        </div>

        <Field label="Certificate number" hint={manualNumber ? 'Manual numbering is enabled. The number must remain unique.' : 'Automatically uses the next number for this semester.'}>
          <div className="inline-control">
            <Input value={record.certificateNumber} readOnly={!manualNumber || Boolean(editingNumber)} onChange={(event) => update('certificateNumber', event.target.value.toUpperCase())} />
            {!editingNumber && <Button variant="secondary" onClick={() => setManualNumber((current) => !current)}>{manualNumber ? 'Use auto' : 'Edit'}</Button>}
          </div>
        </Field>

        <div className="field citation-section">
          <span className="field-label">Achievement citation</span>
          <div className="citation-mode-toggle" role="radiogroup" aria-label="Achievement citation mode">
            <button type="button" role="radio" aria-checked={record.citationMode === 'automatic'} className={record.citationMode === 'automatic' ? 'active' : ''} onClick={() => setCitationMode('automatic')}><Sparkles size={14} /> Recommended wording</button>
            <button type="button" role="radio" aria-checked={record.citationMode === 'custom'} className={record.citationMode === 'custom' ? 'active' : ''} onClick={() => setCitationMode('custom')}>Custom wording</button>
          </div>
          <Textarea
            rows={4}
            readOnly={record.citationMode === 'automatic'}
            value={record.citationMode === 'custom' ? record.customCitation : automaticCitation}
            onChange={(event) => update('customCitation', event.target.value)}
            aria-label="Achievement citation text"
          />
          <span className="field-message">{(record.citationMode === 'custom' ? record.customCitation : automaticCitation).length}/380 characters · automatic wording stays synchronized with the award details.</span>
          {record.citationMode === 'custom' && <button type="button" className="text-button" onClick={() => update('customCitation', automaticCitation)}><Sparkles size={14} /> Restore recommended wording</button>}
        </div>

        <div className="field-grid">
          <Field label="Signature method">
            <Select value={record.signatureMode} onChange={(event) => update('signatureMode', event.target.value as CertificateRecord['signatureMode'])}>
              <option value="wet">Blank lines for wet signatures</option>
              <option value="digital">Use uploaded signature images</option>
            </Select>
          </Field>
          <Field label="Signature layout">
            <Select value={record.signatureLayout} onChange={(event) => update('signatureLayout', event.target.value as CertificateRecord['signatureLayout'])}>
              <option value="two">Two signatures</option>
              <option value="one">One signature</option>
            </Select>
          </Field>
        </div>

        {message && <div className="alert" role="status">{message}</div>}
        <div className="form-actions">
          <Button variant="secondary" onClick={reset}><RotateCcw size={16} /> Reset</Button>
          <Button disabled={busy} onClick={generate}><Download size={16} /> {busy ? 'Generating…' : editingNumber ? 'Reprint PDF' : 'Generate PDF'}</Button>
        </div>
      </section>

      <CertificatePreview record={record} settings={settings} signatures={signatures} />
    </div>
  );
}

function CustomMappingField({
  field,
  value,
  onChange,
}: {
  field: CustomAwardField;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = `${field.label}${field.required ? ' *' : ''}`;
  if (field.type === 'textarea') {
    return <Field label={label} hint={field.helpText || undefined}><Textarea rows={3} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} /></Field>;
  }
  if (field.type === 'select') {
    return (
      <Field label={label} hint={field.helpText || undefined}>
        <Select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select an option</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </Select>
      </Field>
    );
  }
  return <Field label={label} hint={field.helpText || undefined}><Input type={field.type} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} /></Field>;
}
