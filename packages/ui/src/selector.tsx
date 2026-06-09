"use client";

/**
 * Selector Components
 * Reusable selector UI for timeframes, options, etc.
 */

export interface SelectorOption {
  label: string;
  value: string | number;
}

export interface SelectorProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectorOption[];
  className?: string;
}

/**
 * TimeframeSelector
 * Vertical selector for timeframe options
 */
export function TimeframeSelector({
  value,
  onChange,
  options,
  className = "",
}: SelectorProps) {
  return (
    <div
      className={`flex gap-1 bg-bg-assistant rounded-lg p-1 border border-border ${className}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            value === option.value
              ? "bg-teal text-white"
              : "text-muted hover:text-text hover:bg-bg-user"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * HorizontalSelector
 * Horizontal selector for filters/options
 */
export function HorizontalSelector({
  value,
  onChange,
  options,
  className = "",
}: SelectorProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            value === option.value
              ? "bg-teal text-white border-teal"
              : "bg-bg-card text-muted border-border hover:text-text hover:border-teal/50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
