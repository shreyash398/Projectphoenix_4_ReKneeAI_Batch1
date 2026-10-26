import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  highlight = false,
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border ${
        highlight
          ? 'border-teal-calm/60 ring-2 ring-teal-calm/10 shadow-card'
          : 'border-slate-200/70 shadow-soft hover:shadow-card'
      } p-4 sm:p-5 transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
