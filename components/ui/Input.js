'use client';

import { forwardRef } from 'react';

const Input = forwardRef(function Input({
  label,
  error,
  className = '',
  ...rest
}, ref) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input
        ref={ref}
        className={`form-input${error ? ' form-input--error' : ''} ${className}`}
        {...rest}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
});

export default Input;
