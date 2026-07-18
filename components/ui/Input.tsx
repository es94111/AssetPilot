'use client';

import { forwardRef, InputHTMLAttributes, useId } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  label,
  error,
  className = '',
  id: providedId,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}, ref) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const describedByValue = [describedBy, error ? errorId : ''].filter(Boolean).join(' ') || undefined;

  return (
    <div className="mb-4">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        ref={ref}
        id={id}
        aria-describedby={describedByValue}
        aria-invalid={error ? true : ariaInvalid}
        className={`min-h-11 w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          error ? 'border-danger focus:ring-danger' : 'border-gray-300 focus:border-primary'
        } ${className}`}
        {...rest}
      />
      {error && <span id={errorId} role="alert" className="text-danger text-sm mt-1">{error}</span>}
    </div>
  );
});

export { Input };
export default Input;
