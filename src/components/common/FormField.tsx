import React from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  error,
  helperText,
  required = false,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 text-left ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-xs font-bold text-navy-900 uppercase tracking-wider block"
        >
          {label} {required && <span className="text-status-error">*</span>}
        </label>
      </div>

      <div>{children}</div>

      {error ? (
        <p id={`${id}-error`} className="text-[11px] text-status-error font-medium" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-[11px] text-slate-muted leading-tight">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
