"use client";

interface FormStatusBadgeProps {
  tsb: number; // Training Stress Balance (CTL - ATL)
  weekType: string;
}

export default function FormStatusBadge({
  tsb,
  weekType,
}: FormStatusBadgeProps) {
  const getFormStatus = () => {
    // Optimal training zone: TSB between -10 and -30
    if (tsb >= -10 && tsb <= 0) {
      return {
        status: "Fresh",
        color: "text-teal",
        bg: "bg-teal/10",
        border: "border-teal/30",
        icon: "🟢",
        message: "Well-recovered and ready for quality work.",
      };
    }

    if (tsb < -30) {
      return {
        status: "High Fatigue",
        color: "text-orange-bright",
        bg: "bg-orange-bright/10",
        border: "border-orange-bright/30",
        icon: "🟠",
        message:
          weekType === "recovery"
            ? "Appropriate fatigue for recovery week. Rest is crucial."
            : "Approaching overreaching. Consider lighter sessions.",
      };
    }

    if (tsb > 0) {
      return {
        status: "Very Fresh / Taper",
        color: "text-teal",
        bg: "bg-teal/10",
        border: "border-teal/30",
        icon: "🔵",
        message:
          weekType === "recovery"
            ? "Perfect freshness for recovery week."
            : "Low recent training load. Ideal for race prep or testing.",
      };
    }

    // -10 to -30: Optimal
    return {
      status: "Optimal Form",
      color: "text-teal",
      bg: "bg-teal/10",
      border: "border-teal/30",
      icon: "🟢",
      message: `Form: ${Math.round(tsb)}. Safely absorbing ${weekType} stimulus.`,
    };
  };

  const form = getFormStatus();

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${form.border} ${form.bg}`}
    >
      <span className="text-2xl">{form.icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-bold text-sm ${form.color}`}>
            {form.status}
          </span>
          <span className="text-xs text-muted tabular-nums">
            (TSB: {tsb > 0 ? "+" : ""}
            {Math.round(tsb)})
          </span>
        </div>
        <p className="text-xs text-text leading-relaxed">{form.message}</p>
      </div>
    </div>
  );
}
