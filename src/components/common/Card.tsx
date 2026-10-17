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
      className={`bg-white rounded-xl border ${
        highlight ? 'border-teal-calm ring-1 ring-teal-calm/20' : 'border-warm-border'
      } shadow-soft p-4 sm:p-5 transition-shadow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
