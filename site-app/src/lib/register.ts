import { openDB, type DBSchema } from 'idb';
import type { RegisterEntry } from '../types';
import { parseCertificateNumber } from './certificate';

interface CertificateDatabase extends DBSchema {
  certificates: {
    key: string;
    value: RegisterEntry;
    indexes: {
      'by-generated-at': string;
      'by-category': string;
    };
  };
}

const dbPromise = openDB<CertificateDatabase>('cse-certificate-register', 1, {
  upgrade(database) {
    const store = database.createObjectStore('certificates', { keyPath: 'certificateNumber' });
    store.createIndex('by-generated-at', 'generatedAt');
    store.createIndex('by-category', 'awardCategory');
  },
});

export async function getRegister(): Promise<RegisterEntry[]> {
  const database = await dbPromise;
  const entries = await database.getAll('certificates');
  return entries.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export async function getRegisterEntry(certificateNumber: string): Promise<RegisterEntry | undefined> {
  return (await dbPromise).get('certificates', certificateNumber);
}

export async function putRegisterEntry(entry: RegisterEntry): Promise<void> {
  await (await dbPromise).put('certificates', entry);
}

export async function addGeneratedEntry(entry: RegisterEntry): Promise<void> {
  const database = await dbPromise;
  const existing = await database.get('certificates', entry.certificateNumber);
  if (existing) throw new Error(`Certificate number ${entry.certificateNumber} already exists in the register.`);
  await database.add('certificates', entry);
}

export async function markReprinted(certificateNumber: string): Promise<RegisterEntry> {
  const database = await dbPromise;
  const existing = await database.get('certificates', certificateNumber);
  if (!existing) throw new Error('The certificate could not be found in the register.');
  const updated: RegisterEntry = {
    ...existing,
    reprintCount: existing.reprintCount + 1,
    lastGeneratedAt: new Date().toISOString(),
  };
  await database.put('certificates', updated);
  return updated;
}

export async function deleteRegisterEntries(certificateNumbers: string[]): Promise<void> {
  const database = await dbPromise;
  const transaction = database.transaction('certificates', 'readwrite');
  await Promise.all(certificateNumbers.map((number) => transaction.store.delete(number)));
  await transaction.done;
}

export async function clearRegister(): Promise<void> {
  await (await dbPromise).clear('certificates');
}

export function nextSerial(entries: RegisterEntry[], termCode: string, year: string): number {
  return entries.reduce((largest, entry) => {
    const parsed = parseCertificateNumber(entry.certificateNumber);
    if (!parsed || parsed.term !== termCode || parsed.year !== year) return largest;
    return Math.max(largest, parsed.serial);
  }, 0) + 1;
}

export async function mergeRegisterEntries(incoming: RegisterEntry[]): Promise<{ added: number; identical: number; conflicts: string[] }> {
  const database = await dbPromise;
  const transaction = database.transaction('certificates', 'readwrite');
  let added = 0;
  let identical = 0;
  const conflicts: string[] = [];
  for (const entry of incoming) {
    const existing = await transaction.store.get(entry.certificateNumber);
    if (!existing) {
      await transaction.store.add(entry);
      added += 1;
      continue;
    }
    const comparableExisting = JSON.stringify({ ...existing, generatedAt: '', lastGeneratedAt: '', reprintCount: 0 });
    const comparableIncoming = JSON.stringify({ ...entry, generatedAt: '', lastGeneratedAt: '', reprintCount: 0 });
    if (comparableExisting === comparableIncoming) identical += 1;
    else conflicts.push(entry.certificateNumber);
  }
  await transaction.done;
  return { added, identical, conflicts };
}
