'use client';

import { forwardRef, SelectHTMLAttributes } from 'react';

type Option = { label: string; value: string | number } | string;

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: Option[];
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({
  label,
  error,
  options = [],
  className = '',
  ...rest
}, ref) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">{label}</label>}
      <select
        ref={ref}
        className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary ${
          error ? 'border-danger focus:ring-danger' : 'border-gray-300 dark:border-slate-700 focus:border-primary'
        } ${className}`}
        {...rest}
      >
        {options.map(opt =>
          typeof opt === 'string'
            ? <option key={opt} value={opt}>{opt}</option>
            : <option key={opt.value} value={opt.value}>{opt.label}</option>
        )}
      </select>
      {error && <span className="text-danger text-sm mt-1">{error}</span>}
    </div>
  );
});

export { Select };
export default Select;
