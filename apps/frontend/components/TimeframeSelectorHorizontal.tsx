"use client";

interface TimeframeOption {
  label: string;
  value: number;
}

interface TimeframeSelectorHorizontalProps {
  value: number;
  onChange: (value: number) => void;
  options: TimeframeOption[];
}

export default function TimeframeSelectorHorizontal({
  value,
  onChange,
  options,
}: TimeframeSelectorHorizontalProps) {
  return (
    <div className="inline-flex gap-1 bg-bg-assistant border border-border rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
            value === option.value
              ? "bg-teal text-white shadow-sm"
              : "text-muted hover:text-text hover:bg-bg-card"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
