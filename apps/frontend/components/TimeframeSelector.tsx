"use client";

interface TimeframeSelectorProps {
  value: number;
  onChange: (value: number) => void;
  options: { label: string; value: number }[];
}

export default function TimeframeSelector({
  value,
  onChange,
  options,
}: TimeframeSelectorProps) {
  return (
    <div className="flex gap-1 bg-bg-assistant rounded-lg p-1 border border-border">
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
