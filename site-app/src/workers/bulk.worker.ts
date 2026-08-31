/// <reference lib="webworker" />

import type { CertificateRecord, RenderOptions } from '../types';
import { generateCertificatePdf } from '../lib/pdf';

type StartMessage = {
  type: 'start';
  records: CertificateRecord[];
  options: RenderOptions;
};

type CancelMessage = { type: 'cancel' };

let cancelled = false;

self.onmessage = async (event: MessageEvent<StartMessage | CancelMessage>) => {
  if (event.data.type === 'cancel') {
    cancelled = true;
    return;
  }

  cancelled = false;
  const { records, options } = event.data;
  try {
    for (let index = 0; index < records.length; index += 1) {
      if (cancelled) {
        self.postMessage({ type: 'cancelled', completed: index });
        return;
      }
      const bytes = await generateCertificatePdf(records[index], options);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      self.postMessage(
        { type: 'item', index, filenameIndex: index + 1, buffer },
        { transfer: [buffer] },
      );
      self.postMessage({ type: 'progress', completed: index + 1, total: records.length });
    }
    self.postMessage({ type: 'complete', total: records.length });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Bulk generation failed.',
    });
  }
};

export {};
