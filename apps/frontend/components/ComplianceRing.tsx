"use client";

interface ComplianceRingProps {
  actual: number;
  target: number;
  size?: number;
  strokeWidth?: number;
}

export default function ComplianceRing({
  actual,
  target,
  size = 120,
  strokeWidth = 12,
}: ComplianceRingProps) {
  const percentage = Math.round((actual / target) * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate arc positions for zones
  const undertrainedEnd = 0.89 * circumference; // 0-89%
  const optimalStart = undertrainedEnd;
  const optimalEnd = 1.04 * circumference; // 90-104%
  const overtrainedStart = optimalEnd; // 105%+

  // Determine current position and color
  const getStatus = () => {
    if (percentage < 90)
      return { color: "text-peach", zone: "Undertrained", bg: "peach" };
    if (percentage <= 104)
      return { color: "text-teal", zone: "Target Zone", bg: "teal" };
    return {
      color: "text-orange-bright",
      zone: "Overtrained",
      bg: "orange-bright",
    };
  };

  const status = getStatus();
  const progressOffset =
    circumference - (Math.min(percentage, 115) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background zones */}
          {/* Undertrained zone (0-89%) - Peach */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={`${undertrainedEnd} ${circumference - undertrainedEnd}`}
            strokeDashoffset={0}
            className="text-peach opacity-20"
          />

          {/* Optimal zone (90-104%) - Teal */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={`${optimalEnd - optimalStart} ${circumference - (optimalEnd - optimalStart)}`}
            strokeDashoffset={-optimalStart}
            className="text-teal opacity-20"
          />

          {/* Overtrained zone (105%+) - Orange */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference - overtrainedStart} ${overtrainedStart}`}
            strokeDashoffset={-overtrainedStart}
            className="text-orange-bright opacity-20"
          />

          {/* Actual progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`var(--color-${status.bg})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-1xl font-bold tabular-nums ${status.color}`}>
            {percentage}%
          </div>
          <div className="text-[7px] text-muted uppercase tracking-wider mt-0.5 px-1 text-center leading-tight">
            {status.zone}
          </div>
        </div>
      </div>
    </div>
  );
}
