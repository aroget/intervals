"use client";

/**
 * Spinner Component
 * Loading spinner with various sizes
 */

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-4",
  lg: "h-12 w-12 border-4",
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-teal border-t-transparent ${sizeStyles[size]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only"></span>
    </div>
  );
}

/**
 * LoadingState
 * Full loading state with spinner and optional message
 */

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message, className = "" }: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 p-8 ${className}`}
    >
      <Spinner size="lg" />
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}

/**
 * SkeletonLoader
 * Skeleton loading placeholder
 */

export interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({
  className = "",
  width = "w-full",
  height = "h-4",
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-muted/20 rounded ${width} ${height} ${className}`}
    />
  );
}
