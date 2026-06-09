"use client";

/**
 * Badge Component
 * Reusable badge for status indicators, labels, and tags
 */

import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantStyles = {
  default: "bg-bg-assistant text-text border-border",
  success: "bg-teal/10 text-teal border-teal/30",
  warning: "bg-orange/10 text-orange border-orange/30",
  danger: "bg-peach/10 text-peach border-peach/30",
  info: "bg-mint/10 text-mint border-mint/30",
};

const sizeStyles = {
  sm: "text-[9px] px-1.5 py-0.5",
  md: "text-xs px-2 py-1",
  lg: "text-sm px-3 py-1.5",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-semibold ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * FormStatusBadge
 * Shows training form status based on TSB
 */

export interface FormStatusBadgeProps {
  tsb: number;
  weekType: string;
}

export function FormStatusBadge({ tsb, weekType }: FormStatusBadgeProps) {
  const getFormStatus = () => {
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

    return {
      status: "Optimal Zone",
      color: "text-teal",
      bg: "bg-teal/10",
      border: "border-teal/30",
      icon: "✅",
      message: "In the optimal training zone (-10 to -30 TSB).",
    };
  };

  const form = getFormStatus();

  return (
    <div
      className={`rounded-lg border ${form.border} ${form.bg} p-3 space-y-2`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{form.icon}</span>
        <span className={`text-sm font-semibold ${form.color}`}>
          {form.status}
        </span>
        <span className="text-xs text-muted ml-auto">
          TSB: {tsb.toFixed(1)}
        </span>
      </div>
      <p className="text-xs text-muted leading-relaxed">{form.message}</p>
    </div>
  );
}

/**
 * WorkoutBadge
 * Shows workout intensity level
 */

export interface WorkoutBadgeProps {
  intensity: string;
  size?: "sm" | "md" | "lg";
}

const intensityColors: Record<string, string> = {
  recovery: "bg-teal/10 text-teal border-teal/30",
  easy: "bg-mint/10 text-mint border-mint/30",
  moderate: "bg-orange/10 text-orange border-orange/30",
  hard: "bg-orange-bright/10 text-orange-bright border-orange-bright/30",
  max: "bg-peach/10 text-peach border-peach/30",
};

export function WorkoutBadge({ intensity, size = "sm" }: WorkoutBadgeProps) {
  const colorClass =
    intensityColors[intensity.toLowerCase()] || intensityColors.moderate;

  return (
    <Badge variant="default" size={size} className={colorClass}>
      {intensity}
    </Badge>
  );
}
