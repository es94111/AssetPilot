'use client';

/**
 * @param {{
 *   variant?: 'primary'|'secondary'|'danger'|'ghost'|'icon',
 *   size?: 'sm'|'md'|'lg',
 *   loading?: boolean,
 *   className?: string,
 *   children: React.ReactNode,
 *   [key: string]: any
 * }} props
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}) {
  const base = 'btn';
  const variantClass = variant === 'primary' ? 'btn-primary'
    : variant === 'danger'    ? 'btn-danger'
    : variant === 'ghost'     ? 'btn-ghost'
    : variant === 'icon'      ? 'btn-icon'
    : 'btn-secondary';
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

  return (
    <button
      className={[base, variantClass, sizeClass, className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="btn-spinner" /> : null}
      {children}
    </button>
  );
}
