import React from 'react';

interface SliderProps {
  id: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  descriptors?: { [key: number]: string };
  disabled?: boolean;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  id,
  min = 0,
  max = 10,
  step = 1,
  value,
  onChange,
  label,
  descriptors,
  disabled = false,
  className = '',
}) => {
  const currentDescriptor = descriptors?.[value] || '';

  return (
    <div className={`space-y-2.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <label htmlFor={id} className="font-bold text-navy-900 uppercase tracking-wider">
            {label}
          </label>
          <span className="font-bold text-navy-900 px-2 py-0.5 rounded-md bg-warm-subtle border border-warm-border tabular-nums">
            Score: {value} / {max}
          </span>
        </div>
      )}

      {currentDescriptor && (
        <p className="text-xs text-slate-muted italic">{currentDescriptor}</p>
      )}

      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-3 bg-warm-subtle rounded-lg appearance-none cursor-pointer accent-teal-calm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-calm disabled:opacity-50"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={label || 'Scale slider'}
        />

        <div className="flex justify-between text-[10px] text-slate-subtle mt-1.5 font-medium px-0.5">
          <span>{min} (Low)</span>
          <span>{Math.round((max - min) / 2)} (Moderate)</span>
          <span>{max} (Maximum)</span>
        </div>
      </div>
    </div>
  );
};
