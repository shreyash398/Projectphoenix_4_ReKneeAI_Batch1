import React from 'react';

interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  lines = 3,
  className = '',
}) => {
  return (
    <div className={`space-y-3 animate-pulse p-4 bg-white rounded-xl border border-warm-border ${className}`}>
      <div className="h-4 bg-warm-subtle rounded w-2/5 mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 bg-warm-subtle rounded ${
            i % 2 === 0 ? 'w-full' : 'w-4/5'
          }`}
        />
      ))}
    </div>
  );
};
