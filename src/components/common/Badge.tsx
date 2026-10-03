import React from 'react';

export interface BadgeProps {
  variant?: 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'brand',
  size = 'md',
  children,
  className = '',
  icon,
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] font-semibold gap-1',
    md: 'px-2.5 py-1 text-xs font-semibold gap-1.5',
  };

  const variantClasses = {
    brand: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    accent: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    neutral: 'bg-studio-800 text-studio-300 border border-studio-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full tracking-wide uppercase ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
};
