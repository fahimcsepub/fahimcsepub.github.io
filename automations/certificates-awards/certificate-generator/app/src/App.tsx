import * as Tabs from '@radix-ui/react-tabs';
import {
  Award,
  FileStack,
  LockKeyhole,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import '@fontsource/libre-baskerville/latin-400.css';
import '@fontsource/libre-baskerville/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/noto-serif-bengali/bengali-400.css';
import '@fontsource/noto-serif-bengali/bengali-700.css';
import type { GeneratorSettings, RegisterEntry, SessionSignatures } from './types';
import {
  DEFAULT_SETTINGS,
  emptyRecord,
  normalizeCertificateRecord,
  normalizeCustomAwardMappings,
  normalizeTemplateId,
  removeLegacyCourseCoordinationMappings,
} from './lib/certificate';
import { getRegister, putRegisterEntry } from './lib/register';
import { GeneratePanel } from './components/GeneratePanel';

const BulkPanel = lazy(() => import('./components/BulkPanel').then((module) => ({ default: module.BulkPanel })));
const RegisterPanel = lazy(() => import('./components/RegisterPanel').then((module) => ({ default: module.RegisterPanel })));
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then((module) => ({ default: module.SettingsPanel })));

type AppTab = 'generate' | 'bulk' | 'register' | 'settings';

const SETTINGS_STORAGE_KEY = 'cse-generator-settings';
const SETTINGS_VERSION_KEY = 'cse-generator-settings-version';
const SETTINGS_SCHEMA_VERSION = 3;

function loadSettings(): GeneratorSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(SETTINGS_VERSION_KEY, String(SETTINGS_SCHEMA_VERSION));
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(saved) as Partial<GeneratorSettings>;
    const customAwardMappings = removeLegacyCourseCoordinationMappings(
      normalizeCustomAwardMappings(parsed.customAwardMappings),
    );
    localStorage.setItem(SETTINGS_VERSION_KEY, String(SETTINGS_SCHEMA_VERSION));
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      defaultTemplateId: normalizeTemplateId(parsed.defaultTemplateId) ?? DEFAULT_SETTINGS.defaultTemplateId,
      customAwardMappings,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettingsState] = useState<GeneratorSettings>(loadSettings);
  const [signatures, setSignatures] = useState<SessionSignatures>({});
  const [register, setRegister] = useState<RegisterEntry[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>('generate');
  const [draft, setDraft] = useState(() => emptyRecord(settings));
  const [editingNumber, setEditingNumber] = useState<string>();
  const [storageError, setStorageError] = useState<string>();

  const refreshRegister = useCallback(async () => {
    try {
      setRegister(await getRegister());
      setStorageError(undefined);
    } catch {
      setStorageError('Local storage is unavailable. PDFs can still be generated, but the issuance register cannot be saved.');
    }
  }, []);

  useEffect(() => {
    void refreshRegister();
  }, [refreshRegister]);

  function setSettings(next: GeneratorSettings) {
    setSettingsState(next);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(SETTINGS_VERSION_KEY, String(SETTINGS_SCHEMA_VERSION));
  }

  async function onGenerated(entry: RegisterEntry) {
    await putRegisterEntry(entry);
    setEditingNumber(entry.certificateNumber);
    await refreshRegister();
  }

  function editEntry(entry: RegisterEntry) {
    const { citation: _citation, generatedAt: _generatedAt, lastGeneratedAt: _lastGeneratedAt, reprintCount: _reprintCount, ...record } = entry;
    setDraft(normalizeCertificateRecord(record, settings));
    setEditingNumber(entry.certificateNumber);
    setActiveTab('generate');
  }

  function resetDraft() {
    setEditingNumber(undefined);
    setDraft(emptyRecord(settings));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <img src="./assets/cse_department_logo_charcoal_gold.png" alt="Department of CSE logo" className="app-logo" />
        <div>
          <p className="eyebrow">Department of CSE · Certificate Generator</p>
          <h1>PUB Dept. CSE Automations</h1>
        </div>
        <div className="header-meta">
          <span><FileStack size={15} /> {register.length} registered</span>
          <span><LockKeyhole size={15} /> Private on this device</span>
        </div>
      </header>

      {storageError && <div className="global-alert" role="alert">{storageError}</div>}

      <Tabs.Root value={activeTab} onValueChange={(value) => setActiveTab(value as AppTab)}>
        <Tabs.List className="tabs" aria-label="Certificate generator sections">
          <Tabs.Trigger className="tab" value="generate"><Award size={16} /> Generate</Tabs.Trigger>
          <Tabs.Trigger className="tab" value="bulk"><FileStack size={16} /> Bulk import</Tabs.Trigger>
          <Tabs.Trigger className="tab" value="register"><Sparkles size={16} /> Register</Tabs.Trigger>
          <Tabs.Trigger className="tab" value="settings"><SettingsIcon size={16} /> Settings</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="generate">
          <GeneratePanel
            record={draft}
            setRecord={setDraft}
            settings={settings}
            signatures={signatures}
            register={register}
            editingNumber={editingNumber}
            onGenerated={onGenerated}
            onReset={resetDraft}
          />
        </Tabs.Content>
        <Tabs.Content value="bulk">
          <Suspense fallback={<PanelFallback />}><BulkPanel settings={settings} signatures={signatures} register={register} onRegisterChange={refreshRegister} /></Suspense>
        </Tabs.Content>
        <Tabs.Content value="register">
          <Suspense fallback={<PanelFallback />}><RegisterPanel entries={register} settings={settings} signatures={signatures} onChange={refreshRegister} onEdit={editEntry} /></Suspense>
        </Tabs.Content>
        <Tabs.Content value="settings">
          <Suspense fallback={<PanelFallback />}><SettingsPanel settings={settings} setSettings={setSettings} signatures={signatures} setSignatures={setSignatures} /></Suspense>
        </Tabs.Content>
      </Tabs.Root>

      <footer className="app-footer">
        <span>Department of Computer Science &amp; Engineering</span>
        <span>All certificate data stays in your browser.</span>
      </footer>
    </main>
  );
}

function PanelFallback() {
  return <div className="wide-card panel-loading" role="status">Loading workspace…</div>;
}
