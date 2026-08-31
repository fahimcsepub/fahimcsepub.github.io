import {
  Archive,
  Download,
  FileUp,
  Pencil,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { GeneratorSettings, RegisterEntry, SessionSignatures } from '../types';
import { getAwardOptions, getCategoryLabel, getTemplateLabel, safeFilename } from '../lib/certificate';
import { parseRegisterCsv, registerCsv } from '../lib/csv';
import { downloadBlob } from '../lib/download';
import {
  clearRegister,
  deleteRegisterEntries,
  markReprinted,
  mergeRegisterEntries,
} from '../lib/register';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Field';
import { ConfirmDialog } from './ui/Modal';

export function RegisterPanel({
  entries,
  settings,
  signatures,
  onChange,
  onEdit,
}: {
  entries: RegisterEntry[];
  settings: GeneratorSettings;
  signatures: SessionSignatures;
  onChange: () => Promise<void>;
  onEdit: (entry: RegisterEntry) => void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<'delete' | 'clear'>();
  const [message, setMessage] = useState<string>();
  const [busyNumber, setBusyNumber] = useState<string>();
  const importRef = useRef<HTMLInputElement>(null);
  const awardOptions = useMemo(() => {
    const options = getAwardOptions(settings);
    entries.forEach((entry) => {
      if (!options.some((option) => option.id === entry.awardCategory)) {
        options.push({ id: entry.awardCategory, label: getCategoryLabel(entry, settings) });
      }
    });
    return options;
  }, [entries, settings]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesCategory = category === 'all' || entry.awardCategory === category;
      const matchesSearch = !needle || `${entry.recipientName} ${entry.certificateNumber} ${entry.studySemester} ${entry.batch} ${entry.rankingGroup}`.toLowerCase().includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [category, entries, search]);

  function exportRegister() {
    downloadBlob(new Blob([registerCsv(entries, settings)], { type: 'text/csv;charset=utf-8' }), `cse-issuance-register-${Date.now()}.csv`);
  }

  async function importRegister(file: File) {
    setMessage(undefined);
    const { entries: incoming, errors } = parseRegisterCsv(await file.text(), settings);
    if (errors.length) {
      setMessage(`Import stopped: ${errors.slice(0, 3).join(' ')}`);
      return;
    }
    const result = await mergeRegisterEntries(incoming);
    await onChange();
    setMessage(`${result.added} added, ${result.identical} identical ignored${result.conflicts.length ? `, ${result.conflicts.length} conflict${result.conflicts.length === 1 ? '' : 's'} blocked` : ''}.`);
  }

  async function reprint(entry: RegisterEntry) {
    setBusyNumber(entry.certificateNumber);
    setMessage(undefined);
    try {
      const { generateCertificatePdf } = await import('../lib/pdf');
      const bytes = await generateCertificatePdf(entry, {
        settings,
        signatures,
        assetBaseUrl: new URL('assets/', document.baseURI).href,
      });
      downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), safeFilename(entry));
      await markReprinted(entry.certificateNumber);
      await onChange();
      setMessage(`${entry.certificateNumber} reprinted without allocating a new number.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The certificate could not be reprinted.');
    } finally {
      setBusyNumber(undefined);
    }
  }

  async function performConfirmedAction() {
    if (confirmAction === 'clear') {
      await clearRegister();
      setSelected(new Set());
      setMessage('The local issuance register was cleared.');
    } else {
      await deleteRegisterEntries([...selected]);
      setMessage(`${selected.size} register entr${selected.size === 1 ? 'y' : 'ies'} removed.`);
      setSelected(new Set());
    }
    await onChange();
  }

  function toggle(number: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(number)) next.delete(number); else next.add(number);
      return next;
    });
  }

  return (
    <section className="wide-card">
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">Local issuance history</p>
          <h2>Certificate register</h2>
          <p>{entries.length} certificate record{entries.length === 1 ? '' : 's'} stored on this device.</p>
        </div>
        <div className="heading-actions">
          <input ref={importRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && void importRegister(event.target.files[0])} />
          <Button variant="secondary" onClick={() => importRef.current?.click()}><FileUp size={16} /> Import register</Button>
          <Button variant="secondary" disabled={!entries.length} onClick={exportRegister}><Download size={16} /> Export CSV</Button>
        </div>
      </div>

      <div className="register-toolbar">
        <div className="search-control"><Search size={17} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, number, semester, or batch" /></div>
        <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by award category">
          <option value="all">All award categories</option>
          {awardOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </Select>
        <Button variant="danger" disabled={!selected.size} onClick={() => setConfirmAction('delete')}><Trash2 size={15} /> Delete selected</Button>
        <Button variant="ghost" disabled={!entries.length} onClick={() => setConfirmAction('clear')}>Clear all</Button>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state"><Archive size={34} /><strong>No certificates recorded yet</strong><p>Generated certificates will appear here automatically. Export the register periodically as a backup.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table register-table">
            <thead><tr><th><span className="sr-only">Select</span></th><th>Certificate</th><th>Recipient</th><th>Award</th><th>Template</th><th>Result term</th><th>Issued</th><th>Reprints</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.certificateNumber}>
                  <td><input type="checkbox" aria-label={`Select ${entry.certificateNumber}`} checked={selected.has(entry.certificateNumber)} onChange={() => toggle(entry.certificateNumber)} /></td>
                  <td><code>{entry.certificateNumber}</code></td>
                  <td><strong>{entry.recipientName}</strong>{entry.studySemester && <small>{entry.studySemester}</small>}{entry.batch && <small>{entry.batch}</small>}</td>
                  <td>{getCategoryLabel(entry, settings)}</td>
                  <td>{getTemplateLabel(entry.templateId)}</td>
                  <td>{entry.semester} {entry.awardYear}</td>
                  <td>{entry.issueDate}</td>
                  <td>{entry.reprintCount}</td>
                  <td><div className="row-actions"><button aria-label={`Edit ${entry.recipientName}`} onClick={() => onEdit(entry)}><Pencil size={15} /></button><button aria-label={`Reprint ${entry.recipientName}`} disabled={busyNumber === entry.certificateNumber} onClick={() => void reprint(entry)}><Printer size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {message && <div className="alert" role="status">{message}</div>}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => !open && setConfirmAction(undefined)}
        title={confirmAction === 'clear' ? 'Clear the local register?' : 'Delete selected records?'}
        description={confirmAction === 'clear' ? 'This removes every locally stored certificate record. Export a CSV backup first if the history is needed.' : `This removes ${selected.size} selected record${selected.size === 1 ? '' : 's'} from this browser.`}
        confirmLabel={confirmAction === 'clear' ? 'Clear all records' : 'Delete records'}
        destructive
        onConfirm={() => void performConfirmedAction()}
      />
    </section>
  );
}
