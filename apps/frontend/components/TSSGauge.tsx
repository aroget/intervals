"use client";

interface TSSGaugeProps {
  actual: number;
  target: number;
  size?: number;
}

export default function TSSGauge({
  actual,
  target,
  size = 200,
}: TSSGaugeProps) {
  const percentage = target > 0 ? (actual / target) * 100 : 0;

  // Zone definitions
  const undertrainedMax = 90;
  const targetMax = 104;
  // < 90% = undertrained (yellow/peach)
  // 90-104% = optimal (green/teal)
  // > 104% = overtrained (orange/red)

  const getZoneStatus = () => {
    if (percentage < undertrainedMax)
      return { zone: "undertrained", color: "peach", label: "Under Target" };
    if (percentage <= targetMax)
      return { zone: "optimal", color: "teal", label: "On Target" };
    return {
      zone: "overtrained",
      color: "orange-bright",
      label: "Over Target",
    };
  };

  const status = getZoneStatus();

  // Semi-circle gauge (180 degrees)
  const radius = 70;
  const strokeWidth = 14;
  const centerX = 100;
  const centerY = 100;

  // Arc path for semi-circle (from -90° to 90°, which is 180° bottom-up)
  const startAngle = 180; // Start at left (9 o'clock position)
  const endAngle = 0; // End at right (3 o'clock position)

  // Zone boundaries in degrees (0° = right, counterclockwise)
  const undertrainedAngle = startAngle - (undertrainedMax / 120) * 180; // 90% of 120% scale
  const targetAngle = startAngle - (targetMax / 120) * 180; // 104% of 120% scale

  // Needle angle based on percentage (clamped to 0-120% display range)
  const clampedPercentage = Math.min(Math.max(percentage, 0), 120);
  const needleAngle = startAngle - (clampedPercentage / 120) * 180;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad),
    };
  };

  const createArc = (start: number, end: number) => {
    const startPos = polarToCartesian(start);
    const endPos = polarToCartesian(end);
    const largeArc = Math.abs(end - start) > 180 ? 1 : 0;
    return `M ${startPos.x} ${startPos.y} A ${radius} ${radius} 0 ${largeArc} 0 ${endPos.x} ${endPos.y}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 130"
        className="w-full"
        style={{ maxWidth: `${size}px` }}
      >
        {/* Background arc */}
        <path
          d={createArc(startAngle, endAngle)}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-bg-assistant opacity-30"
        />

        {/* Zone 1: Undertrained (0-90%) - Peach */}
        <path
          d={createArc(startAngle, undertrainedAngle)}
          fill="none"
          stroke="var(--color-peach)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="opacity-40"
        />

        {/* Zone 2: Target (90-104%) - Teal */}
        <path
          d={createArc(undertrainedAngle, targetAngle)}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="opacity-90"
        />

        {/* Zone 3: Overtrained (104%+) - Orange Bright */}
        <path
          d={createArc(targetAngle, endAngle)}
          fill="none"
          stroke="var(--color-orange-bright)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="opacity-40"
        />

        {/* Needle */}
        <g transform={`rotate(${needleAngle} ${centerX} ${centerY})`}>
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX + radius - strokeWidth / 2}
            y2={centerY}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-text"
          />
          <circle
            cx={centerX}
            cy={centerY}
            r="6"
            fill="currentColor"
            className="text-text"
          />
        </g>

        {/* Zone markers */}
        <text
          x={polarToCartesian(startAngle).x - 8}
          y={polarToCartesian(startAngle).y + 5}
          className="text-[8px] fill-muted"
          textAnchor="end"
        >
          0%
        </text>
        <text
          x={polarToCartesian(undertrainedAngle).x}
          y={polarToCartesian(undertrainedAngle).y - 8}
          className="text-[8px] fill-muted"
          textAnchor="middle"
        >
          90%
        </text>
        <text
          x={polarToCartesian(targetAngle).x}
          y={polarToCartesian(targetAngle).y - 8}
          className="text-[8px] fill-muted"
          textAnchor="middle"
        >
          104%
        </text>
        <text
          x={polarToCartesian(endAngle).x + 8}
          y={polarToCartesian(endAngle).y + 5}
          className="text-[8px] fill-muted"
          textAnchor="start"
        >
          120%
        </text>
      </svg>

      {/* Center display */}
      <div className="text-center -mt-8">
        <div className="text-3xl font-bold tabular-nums text-text">
          {Math.round(percentage)}%
        </div>
        <div
          className={`text-sm font-semibold mt-1 ${
            status.zone === "optimal"
              ? "text-teal"
              : status.zone === "undertrained"
                ? "text-peach"
                : "text-orange-bright"
          }`}
        >
          {status.label}
        </div>
        <div className="text-xs text-muted mt-2 space-x-2">
          <span className="font-bold text-text">{Math.round(actual)}</span>
          <span>/</span>
          <span>{target} TSS</span>
        </div>
      </div>
    </div>
  );
}
