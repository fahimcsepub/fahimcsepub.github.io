import { cloneElement, isValidElement, useId } from 'react';
import type { InputHTMLAttributes, ReactElement, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  const generatedId = useId();
  const messageId = `${generatedId}-message`;
  const child = isValidElement(children)
    ? children as ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
    : undefined;
  const controlId = child?.props.id ?? generatedId;
  const describedBy = [child?.props['aria-describedby'], (error || hint) ? messageId : undefined].filter(Boolean).join(' ') || undefined;
  const control = child
    ? cloneElement(child, {
      id: controlId,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : child.props['aria-invalid'],
    })
    : children;

  return (
    <div className={cn('field', error && 'field-error')}>
      <label className="field-label" htmlFor={controlId}>{label}</label>
      {control}
      {error ? <span id={messageId} className="field-message error-text">{error}</span> : hint ? <span id={messageId} className="field-message">{hint}</span> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', props.className)} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('input select', props.className)} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('input textarea', props.className)} {...props} />;
}
