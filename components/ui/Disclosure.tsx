import { ChevronDown } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export default function Disclosure({ title, hint, children, className = '', ...props }:
  Omit<ComponentPropsWithoutRef<'details'>, 'title'> & { title: ReactNode; hint?: ReactNode }) {
  return (
    <details {...props} className={`group/disclosure rounded-xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold marker:content-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{title}</span>
        {hint && <span className="text-end text-xs font-normal text-[var(--text-secondary)]">{hint}</span>}
        <ChevronDown size={16} className="disclosure-chevron shrink-0" aria-hidden="true" />
      </summary>
      <div className="border-t border-[var(--border)] px-4 py-3">{children}</div>
    </details>
  );
}
