import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'interactive' | 'active';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4 sm:p-5',
    lg: 'p-6 sm:p-8',
  };

  const variantClasses = {
    default: 'bg-studio-900/90 border border-studio-800 rounded-2xl',
    elevated: 'bg-studio-850 border border-studio-700/60 rounded-2xl shadow-xl shadow-black/40',
    glass: 'glass-panel rounded-2xl',
    interactive:
      'glass-panel glass-panel-hover rounded-2xl cursor-pointer active:scale-[0.99] transition-all duration-200',
    active:
      'bg-studio-850 border-2 border-indigo-500 rounded-2xl shadow-glow-brand transition-all duration-200',
  };

  return (
    <div
      className={`${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
