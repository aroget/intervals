"use client";

/**
 * Card Component
 * Reusable card container for content sections
 */

import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "px-4 sm:px-6 py-4 sm:py-5",
  lg: "p-6 sm:p-8",
};

export function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-bg-card shadow-sm ${paddingStyles[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader Component
 * Standard card header with title and optional description
 */

export interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  description,
  action,
  className = "",
}: CardHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

/**
 * CardSection Component
 * Section within a card with optional border
 */

export interface CardSectionProps {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
}

export function CardSection({
  children,
  className = "",
  bordered = false,
}: CardSectionProps) {
  return (
    <div
      className={`${bordered ? "border-t border-border pt-4 mt-4" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
