import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-studio-300 tracking-wide uppercase"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 text-studio-400 pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full bg-studio-900 border ${
            error ? 'border-rose-500 focus:border-rose-400' : 'border-studio-700/80 focus:border-indigo-500'
          } rounded-xl px-3.5 py-2 text-sm text-studio-100 placeholder-studio-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors ${
            leftIcon ? 'pl-10' : ''
          } ${rightIcon ? 'pr-10' : ''} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 text-studio-400 flex items-center">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-studio-400">{helperText}</p>
      )}
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-studio-300 tracking-wide uppercase"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`w-full bg-studio-900 border ${
          error ? 'border-rose-500 focus:border-rose-400' : 'border-studio-700/80 focus:border-indigo-500'
        } rounded-xl px-3.5 py-2.5 text-sm text-studio-100 placeholder-studio-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-studio-400">{helperText}</p>
      )}
    </div>
  );
};
