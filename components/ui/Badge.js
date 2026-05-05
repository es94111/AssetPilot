'use client';

/**
 * @param {{
 *   variant?: 'income'|'expense'|'net'|'default',
 *   children: React.ReactNode,
 *   className?: string
 * }} props
 */
export default function Badge({ variant = 'default', children, className = '' }) {
  return (
    <span className={`type-badge type-badge--${variant} ${className}`}>
      {children}
    </span>
  );
}
