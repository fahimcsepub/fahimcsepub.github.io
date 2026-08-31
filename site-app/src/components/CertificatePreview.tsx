import { FileWarning, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CertificateRecord, GeneratorSettings, SessionSignatures } from '../types';
import { validateRecord } from '../lib/certificate';

export function CertificatePreview({
  record,
  settings,
  signatures,
}: {
  record: CertificateRecord;
  settings: GeneratorSettings;
  signatures: SessionSignatures;
}) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let nextUrl: string | undefined;
    const timer = window.setTimeout(async () => {
      const errors = validateRecord(record, settings);
      if (errors.length) {
        setError('Complete the required fields to see the final PDF preview.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        const { generateCertificatePdf } = await import('../lib/pdf');
        const bytes = await generateCertificatePdf(record, {
          settings,
          signatures,
          assetBaseUrl: new URL('assets/', document.baseURI).href,
        });
        nextUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
        if (active) {
          setUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous);
            return nextUrl;
          });
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Preview could not be generated.');
      } finally {
        if (active) setLoading(false);
      }
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [record, settings, signatures]);

  return (
    <section className="preview-panel" aria-label="Certificate PDF preview">
      <div className="preview-toolbar">
        <div>
          <p className="eyebrow">Live PDF preview</p>
          <strong>A4 landscape · export-accurate</strong>
        </div>
        <span className="preview-status">{loading ? 'Rendering…' : url ? 'Ready to print' : 'Draft'}</span>
      </div>
      <div className="pdf-stage">
        {url && !error ? (
          <iframe className="pdf-frame" src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} title="Generated certificate preview" />
        ) : (
          <div className="preview-empty">
            {loading ? <LoaderCircle className="spin" size={34} /> : <FileWarning size={34} />}
            <strong>{loading ? 'Preparing certificate' : 'Preview is incomplete'}</strong>
            <p>{error ?? 'Enter the recipient details to render the PDF.'}</p>
          </div>
        )}
      </div>
    </section>
  );
}
