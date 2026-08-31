import { ImagePlus, LockKeyhole, Plus, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CustomAwardMapping, GeneratorSettings, SessionSignatures } from '../types';
import { CERTIFICATE_TEMPLATES, CUSTOM_TEMPLATE_TOKENS, DEFAULT_SETTINGS } from '../lib/certificate';
import { dataUrlFromFile } from '../lib/download';
import { Button } from './ui/Button';
import { Field, Input, Select, Textarea } from './ui/Field';
import { ConfirmDialog } from './ui/Modal';

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
    const reserved = new Set(['ae', 'academic', 'academic excellence', 'academic excellence award', 're', 'research', 'research excellence', 'research excellence award', 'oa', 'outstanding', 'outstanding achievement', 'outstanding achievement award']);
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
        citationTemplate: 'For an exceptional achievement in {{ACHIEVEMENT_AREA}}, bringing distinction to the Department of Computer Science & Engineering.',
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
        <div className="token-list" aria-label="Available citation template placeholders">
          <span>Available fields</span>
          {CUSTOM_TEMPLATE_TOKENS.map((token) => <code key={token}>{token}</code>)}
        </div>
        {mappingIssues.length > 0 && <div className="alert alert-error" role="alert"><strong>Review custom mappings</strong><ul>{mappingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
        {settings.customAwardMappings.length === 0 ? (
          <div className="mapping-empty">No custom mappings yet. The three official award categories remain available.</div>
        ) : (
          <div className="mapping-list">
            {settings.customAwardMappings.map((mapping, index) => (
              <article className="mapping-item" key={mapping.id}>
                <div className="mapping-item-heading">
                  <strong>Custom category {index + 1}</strong>
                  <Button variant="ghost" onClick={() => removeAwardMapping(mapping.id)}><Trash2 size={15} /> Remove</Button>
                </div>
                <div className="field-grid">
                  <Field label="Award category name">
                    <Input value={mapping.label} maxLength={80} onChange={(event) => updateAwardMapping(mapping.id, { label: event.target.value })} placeholder="e.g. Innovation Excellence Award" />
                  </Field>
                  <Field label="CSV aliases" hint="Comma-separated short names, such as IE, Innovation.">
                    <Input value={mapping.aliases.join(', ')} onChange={(event) => updateAwardMapping(mapping.id, { aliases: event.target.value.split(',').map((alias) => alias.trim()).filter(Boolean) })} />
                  </Field>
                </div>
                <Field label="Default achievement citation" hint="Use any available field above. A custom citation on an individual record can still override this wording.">
                  <Textarea rows={3} maxLength={380} value={mapping.citationTemplate} onChange={(event) => updateAwardMapping(mapping.id, { citationTemplate: event.target.value })} />
                </Field>
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
