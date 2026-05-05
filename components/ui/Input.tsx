'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  label,
  error,
  className = '',
  ...rest
}, ref) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        ref={ref}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          error ? 'border-danger focus:ring-danger' : 'border-gray-300 focus:border-primary'
        } ${className}`}
        {...rest}
      />
      {error && <span className="text-danger text-sm mt-1">{error}</span>}
    </div>
  );
});

export default Input;
