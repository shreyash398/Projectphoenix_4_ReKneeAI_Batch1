import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus-visible:outline-teal-calm disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] tracking-tight';

  const sizeClasses = {
    sm: 'text-xs px-3.5 py-1.5 min-h-[36px] gap-1.5',
    md: 'text-sm px-4 py-2.5 min-h-[42px] gap-2 font-medium',
    lg: 'text-sm sm:text-base px-5 py-3 min-h-[46px] gap-2.5 font-semibold',
  }[size];

  const variantClasses = {
    primary: 'bg-teal-calm text-white hover:bg-teal-hover shadow-soft hover:shadow-card',
    secondary: 'bg-navy-900 text-white hover:bg-navy-800 shadow-soft',
    outline: 'border border-slate-200 text-navy-900 bg-white hover:bg-slate-50 hover:border-slate-300',
    danger: 'bg-status-error text-white hover:bg-red-700 shadow-soft',
    ghost: 'text-navy-900 hover:bg-slate-100',
  }[variant];

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
