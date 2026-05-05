'use client';

import { forwardRef } from 'react';

const Select = forwardRef(function Select({
  label,
  error,
  options = [],
  className = '',
  ...rest
}, ref) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <select
        ref={ref}
        className={`form-select${error ? ' form-select--error' : ''} ${className}`}
        {...rest}
      >
        {options.map(opt =>
          typeof opt === 'string'
            ? <option key={opt} value={opt}>{opt}</option>
            : <option key={opt.value} value={opt.value}>{opt.label}</option>
        )}
      </select>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
});

export default Select;
