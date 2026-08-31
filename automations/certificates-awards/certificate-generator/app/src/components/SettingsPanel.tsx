import { ArrowDown, ArrowUp, ImagePlus, LockKeyhole, Plus, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CustomAwardField, CustomAwardMapping, GeneratorSettings, SessionSignatures } from '../types';
import {
  CERTIFICATE_TEMPLATES,
  CUSTOM_TEMPLATE_TOKENS,
  DEFAULT_SETTINGS,
  customFieldToken,
  getTemplateTokens,
  normalizeCustomFieldKey,
} from '../lib/certificate';
import { dataUrlFromFile } from '../lib/download';
import { Button } from './ui/Button';
import { Field, Input, Select, Textarea } from './ui/Field';
import { ConfirmDialog } from './ui/Modal';

type CitationTokenOption = readonly [token: string, label: string];

const COMMON_TOKEN_GROUPS: ReadonlyArray<{ label: string; tokens: ReadonlyArray<CitationTokenOption> }> = [
  {
    label: 'Certificate',
    tokens: [
      ['{{RECIPIENT_NAME}}', 'Recipient name'],
      ['{{AWARD_CATEGORY}}', 'Award category'],
      ['{{ISSUE_DATE}}', 'Formatted issue date'],
    ],
  },
  {
    label: 'Academic context',
    tokens: [
      ['{{STUDY_SEMESTER}}', 'Academic semester'],
      ['{{TERM}}', 'Spring, Summer, or Fall'],
      ['{{YEAR}}', 'Award year'],
      ['{{BATCH}}', 'Batch or cohort'],
      ['{{RANKING_GROUP}}', 'Custom student group'],
    ],
  },
  {
    label: 'Achievement details',
    tokens: [
      ['{{ARTICLE_TITLE}}', 'Research article title'],
      ['{{JOURNAL_NAME}}', 'Journal name'],
      ['{{POSITION_OR_AWARD}}', 'Position or award'],
      ['{{COMPETITION_OR_EVENT}}', 'Competition or event'],
      ['{{ACHIEVEMENT_AREA}}', 'General achievement area'],
    ],
  },
];

export function SettingsPanel({
  settings,
  setSettings,
  signatures,
  setSignatures,
}: {
  settings: GeneratorSettings;
  setSettings: (settings: GeneratorSettings) => void;
  signatures: SessionSignatures;
  setSignatures: (signatures: SessionSignatures) => void;
}) {
  const [message, setMessage] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);
  const update = <K extends keyof GeneratorSettings>(key: K, value: GeneratorSettings[K]) => setSettings({ ...settings, [key]: value });
  const mappingIssues = useMemo(() => {
    const issues: string[] = [];
    const owners = new Map<string, string>();
    const reserved = new Set(['ae', 'academic', 'academic excellence', 'academic excellence award', 're', 'research', 'research excellence', 'research excellence award', 'oa', 'outstanding', 'outstanding achievement', 'outstanding achievement award', 'cc', 'ccea', 'course coordinator', 'course coordination', 'course coordinator award', 'course coordination excellence', 'course coordination excellence award']);
    const commonTokens = new Set<string>(CUSTOM_TEMPLATE_TOKENS.map((token) => token.slice(2, -2)));
    settings.customAwardMappings.forEach((mapping) => {
      if (!mapping.label.trim()) issues.push('Every custom category needs a name.');
      if (!mapping.citationTemplate.trim()) issues.push(`${mapping.label || 'A custom category'} needs a citation template.`);
      [mapping.label, ...mapping.aliases].filter(Boolean).forEach((value) => {
        const key = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
        if (reserved.has(key)) issues.push(`“${value.trim()}” is reserved for an official award category.`);
        const previous = owners.get(key);
        if (previous && previous !== mapping.id) issues.push(`“${value.trim()}” is used by more than one custom category.`);
        else owners.set(key, mapping.id);
      });
      const fieldKeys = new Set<string>();
      mapping.fields.forEach((field) => {
        const key = normalizeCustomFieldKey(field.key);
        if (!key) issues.push(`${mapping.label || 'A custom category'} has a field without a key.`);
        if (!field.label.trim()) issues.push(`${mapping.label || 'A custom category'} has a field without a label.`);
        if (commonTokens.has(key.toUpperCase())) issues.push(`${field.label || key} uses a reserved field key.`);
        if (fieldKeys.has(key)) issues.push(`${mapping.label || 'A custom category'} uses the field key “${key}” more than once.`);
        fieldKeys.add(key);
        if (field.type === 'select' && field.options.length === 0) issues.push(`${field.label || key} needs at least one select option.`);
      });
      getTemplateTokens(mapping.citationTemplate).forEach((token) => {
        if (!commonTokens.has(token) && !fieldKeys.has(token.toLowerCase())) issues.push(`${mapping.label || 'A custom category'} uses undefined citation field {{${token}}}.`);
      });
    });
    return [...new Set(issues)];
  }, [settings.customAwardMappings]);

  function addAwardMapping() {
    const id = `custom:${crypto.randomUUID()}` as const;
    update('customAwardMappings', [
      ...settings.customAwardMappings,
      {
        id,
        label: 'New Excellence Award',
        aliases: [],
        description: 'A reusable department award with configurable certificate fields.',
        enabled: true,
        fields: [{ key: 'achievement_details', label: 'Achievement details', type: 'textarea', required: true, placeholder: 'Describe the recognized achievement', helpText: '', options: [] }],
        citationTemplate: 'For {{ACHIEVEMENT_DETAILS}}, bringing distinction to the Department of Computer Science & Engineering.',
      },
    ]);
  }

  function updateAwardMapping(id: CustomAwardMapping['id'], changes: Partial<CustomAwardMapping>) {
    update('customAwardMappings', settings.customAwardMappings.map((mapping) => (
      mapping.id === id ? { ...mapping, ...changes } : mapping
    )));
  }

  function removeAwardMapping(id: CustomAwardMapping['id']) {
    update('customAwardMappings', settings.customAwardMappings.filter((mapping) => mapping.id !== id));
  }

  function addMappingField(id: CustomAwardMapping['id']) {
    const mapping = settings.customAwardMappings.find((candidate) => candidate.id === id);
    if (!mapping) return;
    const index = mapping.fields.length + 1;
    const field: CustomAwardField = { key: `field_${index}`, label: `Field ${index}`, type: 'text', required: true, placeholder: '', helpText: '', options: [] };
    updateAwardMapping(id, { fields: [...mapping.fields, field] });
  }

  function updateMappingField(id: CustomAwardMapping['id'], index: number, changes: Partial<CustomAwardField>) {
    const mapping = settings.customAwardMappings.find((candidate) => candidate.id === id);
    if (!mapping) return;
    updateAwardMapping(id, { fields: mapping.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...changes } : field) });
  }

  function updateMappingFieldKey(id: CustomAwardMapping['id'], index: number, rawKey: string) {
    const mapping = settings.customAwardMappings.find((candidate) => candidate.id === id);
    if (!mapping) return;
    const nextKey = normalizeCustomFieldKey(rawKey);
    const previousToken = customFieldToken(mapping.fields[index]?.key ?? '');
    const nextToken = customFieldToken(nextKey);
    updateAwardMapping(id, {
      fields: mapping.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, key: nextKey } : field),
      citationTemplate: previousToken !== '{{}}' && nextToken !== '{{}}'
        ? mapping.citationTemplate.split(previousToken).join(nextToken)
        : mapping.citationTemplate,
    });
  }

  function moveMappingField(id: CustomAwardMapping['id'], index: number, direction: -1 | 1) {
    const mapping = settings.customAwardMappings.find((candidate) => candidate.id === id);
    if (!mapping) return;
    const destination = index + direction;
    if (destination < 0 || destination >= mapping.fields.length) return;
    const fields = [...mapping.fields];
    [fields[index], fields[destination]] = [fields[destination], fields[index]];
    updateAwardMapping(id, { fields });
  }

  function removeMappingField(id: CustomAwardMapping['id'], index: number) {
    const mapping = settings.customAwardMappings.find((candidate) => candidate.id === id);
    if (!mapping) return;
    updateAwardMapping(id, { fields: mapping.fields.filter((_, fieldIndex) => fieldIndex !== index) });
  }

  function insertCitationToken(id: CustomAwardMapping['id'], token: string) {
    const mapping = settings.customAwardMappings.find((candidate) => candidate.id === id);
    if (!mapping) return;
    const citation = mapping.citationTemplate.trimEnd();
    updateAwardMapping(id, { citationTemplate: `${citation}${citation ? ' ' : ''}${token}` });
  }

  async function uploadSignature(file: File, slot: 'first' | 'second') {
    setMessage(undefined);
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setMessage('Signature files must be PNG or JPEG images.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Signature images must be smaller than 2 MB.');
      return;
    }
    try {
      const dataUrl = await dataUrlFromFile(file);
      setSignatures({ ...signatures, [slot]: dataUrl });
      setMessage('Signature loaded for this browser session only.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The signature image could not be loaded.');
    }
  }

  return (
    <div className="settings-grid">
      <section className="settings-card">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow gold">Certificate wording</p><h2>Institution and signatories</h2></div>
        </div>
        <Field label="University name"><Input value={settings.universityName} onChange={(event) => update('universityName', event.target.value)} /></Field>
        <Field label="Department name"><Input value={settings.departmentName} onChange={(event) => update('departmentName', event.target.value)} /></Field>
        <Field label="Main certificate title"><Input value={settings.certificateTitle} onChange={(event) => update('certificateTitle', event.target.value)} /></Field>
        <Field label="Default certificate template" hint="New single and bulk records start with this design.">
          <Select value={settings.defaultTemplateId} onChange={(event) => update('defaultTemplateId', event.target.value as GeneratorSettings['defaultTemplateId'])}>
            {CERTIFICATE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
          </Select>
        </Field>
        <div className="field-grid">
          <Field label="First signatory label"><Input value={settings.signatoryOneLabel} onChange={(event) => update('signatoryOneLabel', event.target.value)} /></Field>
          <Field label="Second signatory label"><Input value={settings.signatoryTwoLabel} onChange={(event) => update('signatoryTwoLabel', event.target.value)} /></Field>
        </div>
        <div className="field-grid">
          <Field label="Default signature method"><Select value={settings.defaultSignatureMode} onChange={(event) => update('defaultSignatureMode', event.target.value as GeneratorSettings['defaultSignatureMode'])}><option value="wet">Wet signatures</option><option value="digital">Digital signature images</option></Select></Field>
          <Field label="Default signature layout"><Select value={settings.defaultSignatureLayout} onChange={(event) => update('defaultSignatureLayout', event.target.value as GeneratorSettings['defaultSignatureLayout'])}><option value="two">Two signatures</option><option value="one">One signature</option></Select></Field>
        </div>
        <Field label="Certificate number prefix" hint={`Example: ${settings.numberPrefix || 'CSE'}/SPR-2026/001`}><Input value={settings.numberPrefix} maxLength={8} onChange={(event) => update('numberPrefix', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></Field>
        <Button variant="secondary" onClick={() => setConfirmReset(true)}><RefreshCcw size={16} /> Restore official defaults</Button>
      </section>

      <section className="settings-card">
        <div className="page-heading compact-heading"><div><p className="eyebrow gold">Session-only files</p><h2>Authorized signatures</h2><p>Transparent PNG images produce the cleanest result.</p></div></div>
        <div className="signature-upload-grid">
          <SignatureUpload label={settings.signatoryOneLabel} value={signatures.first} onUpload={(file) => void uploadSignature(file, 'first')} onClear={() => setSignatures({ ...signatures, first: undefined })} />
          <SignatureUpload label={settings.signatoryTwoLabel} value={signatures.second} onUpload={(file) => void uploadSignature(file, 'second')} onClear={() => setSignatures({ ...signatures, second: undefined })} />
        </div>
        <div className="privacy-note"><LockKeyhole size={19} /><div><strong>Signatures are never saved</strong><p>They stay in memory only until this page is closed or refreshed. They are not included in the public website files.</p></div></div>
        {message && <div className="alert" role="status">{message}</div>}
      </section>

      <section className="settings-card mapping-card">
        <div className="page-heading compact-heading">
          <div>
            <p className="eyebrow gold">Flexible award wording</p>
            <h2>Custom award mappings</h2>
            <p>Add a reusable category for the form and CSV importer. Existing issued records retain their saved category wording.</p>
          </div>
          <Button variant="secondary" onClick={addAwardMapping}><Plus size={16} /> Add category</Button>
        </div>
        <details className="token-guide">
          <summary>Common citation fields <span>What can I place in a citation?</span></summary>
          <p>These fields are replaced automatically when a certificate is generated. Use only the fields relevant to your award.</p>
          <div className="token-reference-grid" aria-label="Available citation template fields">
            {COMMON_TOKEN_GROUPS.map((group) => (
              <section key={group.label}>
                <strong>{group.label}</strong>
                {group.tokens.map(([token, label]) => <div key={token}><code>{token}</code><span>{label}</span></div>)}
              </section>
            ))}
          </div>
          <small><code>{'{{SEMESTER}}'}</code> remains supported as a legacy alias for <code>{'{{TERM}}'}</code>.</small>
        </details>
        {mappingIssues.length > 0 && <div className="alert alert-error" role="alert"><strong>Review custom mappings</strong><ul>{mappingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
        {settings.customAwardMappings.length === 0 ? (
          <div className="mapping-empty">No custom mappings yet. The four official award categories remain available.</div>
        ) : (
          <div className="mapping-list">
            {settings.customAwardMappings.map((mapping, index) => (
              <article className="mapping-item" key={mapping.id}>
                <div className="mapping-item-heading">
                  <div><strong>Custom category {index + 1}</strong><span className={mapping.enabled ? 'mapping-status active' : 'mapping-status'}>{mapping.enabled ? 'Available' : 'Hidden for new certificates'}</span></div>
                  <Button variant="ghost" onClick={() => removeAwardMapping(mapping.id)}><Trash2 size={15} /> Remove</Button>
                </div>
                <section className="mapping-section">
                  <div className="mapping-step-heading"><span>1</span><div><strong>Category details</strong><small>Name this award and define how administrators find it.</small></div></div>
                  <label className="check-row compact mapping-enabled">
                    <input type="checkbox" checked={mapping.enabled} onChange={(event) => updateAwardMapping(mapping.id, { enabled: event.target.checked })} />
                    <span><strong>Make this category available</strong><small>Turning it off hides it from new forms while issued register records remain usable.</small></span>
                  </label>
                  <div className="field-grid">
                    <Field label="Award category name" hint="Printed as the certificate subtitle.">
                      <Input value={mapping.label} maxLength={80} onChange={(event) => updateAwardMapping(mapping.id, { label: event.target.value })} placeholder="e.g. Innovation Excellence Award" />
                    </Field>
                    <Field label="CSV aliases" hint="Optional short names, separated by commas.">
                      <Input value={mapping.aliases.join(', ')} onChange={(event) => updateAwardMapping(mapping.id, { aliases: event.target.value.split(',').map((alias) => alias.trim()).filter(Boolean) })} placeholder="e.g. IE, Innovation" />
                    </Field>
                  </div>
                  <Field label="Internal description" hint="Helps administrators choose the correct award; it is never printed.">
                    <Input value={mapping.description} maxLength={180} onChange={(event) => updateAwardMapping(mapping.id, { description: event.target.value })} placeholder="When should this award be used?" />
                  </Field>
                </section>

                <div className="mapping-fields-heading mapping-step-heading">
                  <span>2</span>
                  <div><strong>Certificate input fields</strong><small>Add only the information needed to build this award’s citation.</small></div>
                  <Button variant="secondary" onClick={() => addMappingField(mapping.id)}><Plus size={15} /> Add field</Button>
                </div>
                {mapping.fields.length === 0 ? (
                  <div className="mapping-field-empty">No custom input fields. You may still use the common citation fields below.</div>
                ) : (
                  <div className="mapping-fields-list">
                    {mapping.fields.map((field, fieldIndex) => (
                      <div className="mapping-field-item" key={`${mapping.id}-${fieldIndex}`}>
                        <div className="mapping-field-toolbar">
                          <span>Field {fieldIndex + 1}</span>
                          <code>{customFieldToken(field.key)}</code>
                          <button type="button" aria-label={`Move ${field.label} up`} disabled={fieldIndex === 0} onClick={() => moveMappingField(mapping.id, fieldIndex, -1)}><ArrowUp size={14} /></button>
                          <button type="button" aria-label={`Move ${field.label} down`} disabled={fieldIndex === mapping.fields.length - 1} onClick={() => moveMappingField(mapping.id, fieldIndex, 1)}><ArrowDown size={14} /></button>
                          <button type="button" aria-label={`Remove ${field.label}`} onClick={() => removeMappingField(mapping.id, fieldIndex)}><Trash2 size={14} /></button>
                        </div>
                        <div className="field-grid mapping-field-grid">
                          <Field label="Field label" hint="What the administrator sees in Generate and Bulk Import."><Input value={field.label} onChange={(event) => updateMappingField(mapping.id, fieldIndex, { label: event.target.value })} placeholder="e.g. Project title" /></Field>
                          <Field label="Input type" hint="Choose the control best suited to this information."><Select value={field.type} onChange={(event) => updateMappingField(mapping.id, fieldIndex, { type: event.target.value as CustomAwardField['type'] })}><option value="text">Short text</option><option value="textarea">Long text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Dropdown</option></Select></Field>
                          <div className="field mapping-span-full">
                            <label className="field-label" htmlFor={`${mapping.id}-${fieldIndex}-key`}>CSV column key</label>
                            <div className="csv-key-control"><span>field_</span><Input id={`${mapping.id}-${fieldIndex}-key`} value={field.key} onChange={(event) => updateMappingFieldKey(mapping.id, fieldIndex, event.target.value)} placeholder="project_title" /></div>
                            <span className="field-message">Citation field: <code>{customFieldToken(normalizeCustomFieldKey(field.key) || 'key')}</code></span>
                          </div>
                        </div>
                        <div className="field-grid">
                          <Field label="Example shown inside the field" hint="A short example disappears when the user starts typing."><Input value={field.placeholder} onChange={(event) => updateMappingField(mapping.id, fieldIndex, { placeholder: event.target.value })} placeholder="e.g. Smart Attendance System" /></Field>
                          <Field label="Instruction below the field" hint="Optional guidance that remains visible."><Input value={field.helpText} onChange={(event) => updateMappingField(mapping.id, fieldIndex, { helpText: event.target.value })} placeholder="e.g. Use the official project title" /></Field>
                        </div>
                        {field.type === 'select' && <Field label="Dropdown choices" hint="Separate choices with commas, for example: Champion, Runner-up, Finalist"><Input value={field.options.join(', ')} onChange={(event) => updateMappingField(mapping.id, fieldIndex, { options: event.target.value.split(',').map((option) => option.trim()).filter(Boolean) })} /></Field>}
                        <label className="check-row compact field-required"><input type="checkbox" checked={field.required} onChange={(event) => updateMappingField(mapping.id, fieldIndex, { required: event.target.checked })} /><span><strong>Required field</strong><small>Automatic citation generation is blocked until this value is provided.</small></span></label>
                      </div>
                    ))}
                  </div>
                )}

                <section className="mapping-section citation-builder">
                  <div className="mapping-step-heading"><span>3</span><div><strong>Recommended citation</strong><small>Write the sentence printed below the recipient name.</small></div></div>
                  <div className="citation-field-picker" aria-label={`Insert citation fields for ${mapping.label}`}>
                    <span>Click a field to insert it</span>
                    <div>
                      {mapping.fields.map((field) => <button type="button" key={field.key} onClick={() => insertCitationToken(mapping.id, customFieldToken(field.key))}>{field.label || field.key}<code>{customFieldToken(field.key)}</code></button>)}
                      {COMMON_TOKEN_GROUPS.flatMap((group) => group.tokens).map(([token, label]) => <button type="button" key={token} onClick={() => insertCitationToken(mapping.id, token)}>{label}<code>{token}</code></button>)}
                    </div>
                  </div>
                  <Field label="Citation template" hint={`${mapping.citationTemplate.length}/380 characters · fields inside {{double braces}} are filled automatically.`}>
                    <Textarea rows={4} maxLength={380} value={mapping.citationTemplate} onChange={(event) => updateAwardMapping(mapping.id, { citationTemplate: event.target.value })} />
                  </Field>
                  <div className="mapping-tip"><strong>Example</strong><span>For outstanding innovation through <code>{'{{PROJECT_TITLE}}'}</code>, bringing distinction to the Department of Computer Science &amp; Engineering.</span></div>
                </section>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="settings-card privacy-card">
        <ShieldCheck size={24} />
        <div><p className="eyebrow">Privacy model</p><h3>Local by design</h3><p>Names, citations, CSV files, signatures, and generated PDFs are processed entirely on this device. The site has no account, server, analytics service, or certificate database.</p></div>
      </section>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Restore official defaults?"
        description="This resets institution wording, the default certificate template, numbering prefix, signatory labels, and custom award mappings. Local certificate records are not affected."
        confirmLabel="Restore defaults"
        onConfirm={() => { setSettings(DEFAULT_SETTINGS); setMessage('Official defaults restored.'); }}
      />
    </div>
  );
}

function SignatureUpload({
  label,
  value,
  onUpload,
  onClear,
}: {
  label: string;
  value?: string;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="signature-upload">
      <span>{label}</span>
      {value ? <img src={value} alt={`Uploaded signature for ${label}`} /> : <div className="signature-placeholder"><ImagePlus size={24} /><small>No signature loaded</small></div>}
      <div className="signature-actions">
        <label className="button button-secondary file-button">Choose image<input type="file" accept="image/png,image/jpeg" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} /></label>
        {value && <Button variant="ghost" onClick={onClear}><Trash2 size={15} /> Remove</Button>}
      </div>
    </div>
  );
}
