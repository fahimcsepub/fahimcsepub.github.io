import JSZip from 'jszip';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  LoaderCircle,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { BulkRow, CertificateRecord, CustomAwardField, GeneratorSettings, RegisterEntry, SessionSignatures } from '../types';
import { CERTIFICATE_TEMPLATES, generateCitation, getAwardOptions, getCategoryLabel, getCustomAwardMapping, getCustomFieldsForRecord, isCustomCategory, safeFilename } from '../lib/certificate';
import { errorCsv, parseBulkCsv, registerCsv, revalidateBulkRows, rowsToRegisterEntries, sampleCsv } from '../lib/csv';
import { downloadBlob } from '../lib/download';
import { addGeneratedEntry } from '../lib/register';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Field';

type OutputChoice = { zip: boolean; combined: boolean; register: boolean };

export function BulkPanel({
  settings,
  signatures,
  register,
  onRegisterChange,
}: {
  settings: GeneratorSettings;
  signatures: SessionSignatures;
  register: RegisterEntry[];
  onRegisterChange: () => Promise<void>;
}) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [expandedId, setExpandedId] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [message, setMessage] = useState<string>();
  const [outputs, setOutputs] = useState<OutputChoice>({ zip: true, combined: true, register: true });
  const workerRef = useRef<Worker | undefined>(undefined);
  const generatedRef = useRef<Uint8Array[]>([]);
  const activeRowsRef = useRef<BulkRow[]>([]);

  const validRows = useMemo(() => rows.filter((row) => row.errors.length === 0), [rows]);
  const invalidRows = rows.length - validRows.length;
  const awardOptions = useMemo(() => {
    const options = getAwardOptions(settings);
    rows.forEach((row) => {
      if (!options.some((option) => option.id === row.record.awardCategory)) {
        options.push({ id: row.record.awardCategory, label: getCategoryLabel(row.record, settings) });
      }
    });
    return options;
  }, [rows, settings]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!generating) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [generating]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  async function importFile(file: File) {
    setMessage(undefined);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileErrors(['Please choose a CSV file.']);
      return;
    }
    const text = await file.text();
    const parsed = parseBulkCsv(text, settings, register);
    setRows(parsed.rows);
    setFileErrors(parsed.fileErrors);
    setFileName(file.name);
    setExpandedId(undefined);
  }

  function updateRecord(id: string, key: keyof CertificateRecord, value: CertificateRecord[keyof CertificateRecord]) {
    setRows((current) => {
      const updated = current.map((row) => row.id === id ? { ...row, record: { ...row.record, [key]: value } } : row);
      return revalidateBulkRows(updated, register, settings);
    });
  }

  function updateAwardCategory(id: string, category: CertificateRecord['awardCategory']) {
    const mapping = getCustomAwardMapping(category, settings);
    setRows((current) => revalidateBulkRows(current.map((row) => row.id === id ? {
      ...row,
      record: {
        ...row.record,
        awardCategory: category,
        citationMode: 'automatic',
        customCitation: '',
        customFields: Object.fromEntries((mapping?.fields ?? []).map((field) => [field.key, ''])),
        customCategoryLabel: mapping?.label ?? '',
        customCategoryTemplate: mapping?.citationTemplate ?? '',
        customCategoryFields: mapping?.fields ?? [],
      },
    } : row), register, settings));
  }

  function updateCustomField(id: string, key: string, value: string) {
    setRows((current) => revalidateBulkRows(current.map((row) => row.id === id ? {
      ...row,
      record: { ...row.record, customFields: { ...row.record.customFields, [key]: value } },
    } : row), register, settings));
  }

  function downloadSample() {
    downloadBlob(new Blob([sampleCsv(settings)], { type: 'text/csv;charset=utf-8' }), 'cse_certificate_import_template.csv');
  }

  function downloadErrors() {
    downloadBlob(new Blob([errorCsv(rows)], { type: 'text/csv;charset=utf-8' }), 'cse_certificate_import_errors.csv');
  }

  async function finalizeGeneration() {
    const bytes = generatedRef.current;
    const activeRows = activeRowsRef.current;
    const entries = rowsToRegisterEntries(activeRows, settings);
    try {
      if (outputs.zip) {
        const zip = new JSZip();
        bytes.forEach((file, index) => {
          const group = `group-${String(Math.floor(index / 100) + 1).padStart(3, '0')}`;
          zip.file(`${group}/${safeFilename(activeRows[index].record)}`, file);
        });
        if (outputs.register) zip.file('issuance-register.csv', registerCsv(entries, settings));
        const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        downloadBlob(archive, `cse-certificates-${Date.now()}.zip`);
      }
      if (outputs.combined) {
        const { combineCertificatePdfs } = await import('../lib/pdf');
        const combined = await combineCertificatePdfs(bytes);
        downloadBlob(new Blob([combined as BlobPart], { type: 'application/pdf' }), `cse-certificates-combined-${Date.now()}.pdf`);
      }
      if (outputs.register && !outputs.zip) {
        downloadBlob(new Blob([registerCsv(entries, settings)], { type: 'text/csv;charset=utf-8' }), `cse-issuance-register-${Date.now()}.csv`);
      }
      for (const entry of entries) await addGeneratedEntry(entry);
      await onRegisterChange();
      setMessage(`${entries.length} certificate${entries.length === 1 ? '' : 's'} generated and recorded locally.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The output package could not be completed.');
    } finally {
      setGenerating(false);
      workerRef.current?.terminate();
      workerRef.current = undefined;
    }
  }

  function startGeneration() {
    setMessage(undefined);
    if (!validRows.length || (!outputs.zip && !outputs.combined && !outputs.register)) {
      setMessage('Select at least one valid row and one output format.');
      return;
    }
    generatedRef.current = new Array(validRows.length);
    activeRowsRef.current = validRows;
    setProgress({ completed: 0, total: validRows.length });
    setGenerating(true);
    const worker = new Worker(new URL('../workers/bulk.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent) => {
      const payload = event.data;
      if (payload.type === 'item') generatedRef.current[payload.index] = new Uint8Array(payload.buffer);
      if (payload.type === 'progress') setProgress({ completed: payload.completed, total: payload.total });
      if (payload.type === 'complete') void finalizeGeneration();
      if (payload.type === 'cancelled') {
        setGenerating(false);
        setMessage(`Generation cancelled after ${payload.completed} certificate${payload.completed === 1 ? '' : 's'}. No register records were added.`);
        worker.terminate();
      }
      if (payload.type === 'error') {
        setGenerating(false);
        setMessage(payload.message);
        worker.terminate();
      }
    };
    worker.onerror = (event) => {
      setGenerating(false);
      setMessage(event.message || 'The background generator stopped unexpectedly.');
      worker.terminate();
    };
    worker.postMessage({
      type: 'start',
      records: validRows.map((row) => row.record),
      options: {
        settings,
        signatures,
        assetBaseUrl: new URL('assets/', document.baseURI).href,
      },
    });
  }

  function cancelGeneration() {
    workerRef.current?.postMessage({ type: 'cancel' });
  }

  return (
    <section className="wide-card">
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">Bulk production</p>
          <h2>Generate from CSV</h2>
          <p>Import up to 500 approved recipients. Everything is processed inside this browser.</p>
        </div>
        <Button variant="secondary" onClick={downloadSample}><FileDown size={16} /> Download CSV template</Button>
      </div>

      <label
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void importFile(file);
        }}
      >
        <UploadCloud size={28} />
        <strong>{fileName ?? 'Drop a CSV here or choose a file'}</strong>
        <span>Full category names, custom aliases, and legacy AE, RE, or OA values are accepted.</span>
        <input type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && void importFile(event.target.files[0])} />
      </label>

      {fileErrors.length > 0 && <div className="alert alert-error"><strong>CSV file issues</strong><ul>{fileErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

      {rows.length > 0 && (
        <>
          <div className="batch-summary">
            <span><FileSpreadsheet size={17} /> {rows.length} imported</span>
            <span className="valid"><CheckCircle2 size={17} /> {validRows.length} valid</span>
            <span className={invalidRows ? 'invalid' : ''}><AlertTriangle size={17} /> {invalidRows} need attention</span>
            {invalidRows > 0 && <Button variant="secondary" onClick={downloadErrors}><Download size={15} /> Error CSV</Button>}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Row</th><th>Recipient</th><th>Category</th><th>Template</th><th>Result term</th><th>Certificate number</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr className={row.errors.length ? 'invalid-row' : ''}>
                      <td>{row.sourceLine}</td>
                      <td><Input className="table-input" value={row.record.recipientName} onChange={(event) => updateRecord(row.id, 'recipientName', event.target.value)} /></td>
                      <td><Select className="table-input" value={row.record.awardCategory} onChange={(event) => updateAwardCategory(row.id, event.target.value as CertificateRecord['awardCategory'])}>{awardOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select></td>
                      <td><Select className="table-input" value={row.record.templateId} onChange={(event) => updateRecord(row.id, 'templateId', event.target.value as CertificateRecord['templateId'])}>{CERTIFICATE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</Select></td>
                      <td><div className="term-cell"><Select className="table-input" value={row.record.semester} onChange={(event) => updateRecord(row.id, 'semester', event.target.value as CertificateRecord['semester'])}><option>Spring</option><option>Summer</option><option>Fall</option></Select><Input className="table-input year" value={row.record.awardYear} onChange={(event) => updateRecord(row.id, 'awardYear', event.target.value)} /></div></td>
                      <td><Input className="table-input certificate-cell" value={row.record.certificateNumber} onChange={(event) => updateRecord(row.id, 'certificateNumber', event.target.value.toUpperCase())} /></td>
                      <td><button className={`status-button ${row.errors.length ? 'bad' : 'good'}`} onClick={() => setExpandedId(expandedId === row.id ? undefined : row.id)}>{row.errors.length ? <><XCircle size={14} /> {row.errors.length} issue{row.errors.length === 1 ? '' : 's'}</> : <><CheckCircle2 size={14} /> Ready</>}</button></td>
                    </tr>
                    {expandedId === row.id && (
                      <tr className="detail-row"><td colSpan={7}>
                        <div className="row-details">
                          <strong>{getCategoryLabel(row.record, settings)} details</strong>
                          {row.record.awardCategory === 'academic' && <>
                            <label>Ranking scope<Select value={row.record.academicScope} onChange={(event) => updateRecord(row.id, 'academicScope', event.target.value as CertificateRecord['academicScope'])}><option value="semester">Academic semester</option><option value="batch">Specific batch</option><option value="custom">Custom student group</option></Select></label>
                            {row.record.academicScope === 'semester' && <label>Academic semester<Input value={row.record.studySemester} onChange={(event) => updateRecord(row.id, 'studySemester', event.target.value)} placeholder="e.g. 4th Semester" /></label>}
                            {row.record.academicScope === 'batch' && <label>Batch or cohort<Input value={row.record.batch} onChange={(event) => updateRecord(row.id, 'batch', event.target.value)} placeholder="e.g. HSC Batch 12" /></label>}
                            {row.record.academicScope === 'custom' && <label>Student group<Input value={row.record.rankingGroup} onChange={(event) => updateRecord(row.id, 'rankingGroup', event.target.value)} /></label>}
                          </>}
                          {row.record.awardCategory === 'research' && <><label>Article title<Input value={row.record.articleTitle} onChange={(event) => updateRecord(row.id, 'articleTitle', event.target.value)} /></label><label>Journal<Input value={row.record.journalName} onChange={(event) => updateRecord(row.id, 'journalName', event.target.value)} /></label><label className="check-row compact"><input type="checkbox" checked={row.record.q1Verified} onChange={(event) => updateRecord(row.id, 'q1Verified', event.target.checked)} /> Q1 verified</label></>}
                          {row.record.awardCategory === 'outstanding' && <><label>Achievement type<Select value={row.record.achievementType} onChange={(event) => updateRecord(row.id, 'achievementType', event.target.value as CertificateRecord['achievementType'])}><option value="competition">Competition</option><option value="general">General</option></Select></label>{row.record.achievementType === 'competition' ? <><label>Position or award<Input value={row.record.positionOrAward} onChange={(event) => updateRecord(row.id, 'positionOrAward', event.target.value)} /></label><label>Competition or event<Input value={row.record.competitionOrEvent} onChange={(event) => updateRecord(row.id, 'competitionOrEvent', event.target.value)} /></label></> : <label>Achievement area<Input value={row.record.achievementArea} onChange={(event) => updateRecord(row.id, 'achievementArea', event.target.value)} /></label>}</>}
                          {isCustomCategory(row.record.awardCategory) && getCustomFieldsForRecord(row.record, settings).map((field) => <BulkCustomMappingField key={field.key} field={field} value={row.record.customFields[field.key] ?? ''} onChange={(value) => updateCustomField(row.id, field.key, value)} />)}
                          {isCustomCategory(row.record.awardCategory) && getCustomFieldsForRecord(row.record, settings).length === 0 && (row.record.customCategoryTemplate ?? '').includes('{{ACHIEVEMENT_AREA}}') && <label>Achievement details<Input value={row.record.achievementArea} onChange={(event) => updateRecord(row.id, 'achievementArea', event.target.value)} /></label>}
                          {isCustomCategory(row.record.awardCategory) && getCustomFieldsForRecord(row.record, settings).length === 0 && (row.record.customCategoryTemplate ?? '').includes('{{BATCH}}') && <label>Batch<Input value={row.record.batch} onChange={(event) => updateRecord(row.id, 'batch', event.target.value)} /></label>}
                          <label>Citation mode<Select value={row.record.citationMode} onChange={(event) => {
                            const mode = event.target.value as CertificateRecord['citationMode'];
                            updateRecord(row.id, 'citationMode', mode);
                            if (mode === 'custom' && !row.record.customCitation.trim()) updateRecord(row.id, 'customCitation', generateCitation({ ...row.record, citationMode: 'automatic' }, settings));
                          }}><option value="automatic">Recommended wording</option><option value="custom">Custom wording</option></Select></label>
                          <label className="span-all">Achievement citation<Textarea rows={3} readOnly={row.record.citationMode === 'automatic'} value={row.record.citationMode === 'custom' ? row.record.customCitation : generateCitation({ ...row.record, citationMode: 'automatic' }, settings)} onChange={(event) => updateRecord(row.id, 'customCitation', event.target.value)} /></label>
                          {row.errors.length > 0 && <ul className="row-errors">{row.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="output-panel">
            <div><p className="eyebrow">Output package</p><strong>Choose the files to prepare</strong></div>
            <label className="toggle-check"><input type="checkbox" checked={outputs.zip} onChange={(event) => setOutputs({ ...outputs, zip: event.target.checked })} /> ZIP of individual PDFs</label>
            <label className="toggle-check"><input type="checkbox" checked={outputs.combined} onChange={(event) => setOutputs({ ...outputs, combined: event.target.checked })} /> Combined PDF</label>
            <label className="toggle-check"><input type="checkbox" checked={outputs.register} onChange={(event) => setOutputs({ ...outputs, register: event.target.checked })} /> Register CSV</label>
            {!generating ? <Button onClick={startGeneration} disabled={!validRows.length}><FileDown size={16} /> Generate {validRows.length} valid</Button> : <Button variant="danger" onClick={cancelGeneration}>Cancel</Button>}
          </div>

          {generating && (
            <div className="progress-card" aria-live="polite">
              <LoaderCircle className="spin" size={19} />
              <div><strong>Generating certificate {Math.min(progress.completed + 1, progress.total)} of {progress.total}</strong><div className="progress-track"><span style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} /></div></div>
              <span>{Math.round(progress.total ? (progress.completed / progress.total) * 100 : 0)}%</span>
            </div>
          )}
        </>
      )}

      {message && <div className="alert" role="status">{message}</div>}
    </section>
  );
}

function BulkCustomMappingField({
  field,
  value,
  onChange,
}: {
  field: CustomAwardField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'select') {
    return <label>{field.label}{field.required ? ' *' : ''}<Select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select an option</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</Select></label>;
  }
  if (field.type === 'textarea') {
    return <label>{field.label}{field.required ? ' *' : ''}<Textarea rows={2} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
  }
  return <label>{field.label}{field.required ? ' *' : ''}<Input type={field.type} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}
