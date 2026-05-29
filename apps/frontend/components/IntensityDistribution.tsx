"use client";

interface ZoneData {
  zone: string;
  targetPercentage: number;
  actualPercentage: number;
  color: string;
}

interface IntensityDistributionProps {
  targetDistribution: ZoneData[];
  actualDistribution: ZoneData[];
  title?: string;
}

export default function IntensityDistribution({
  targetDistribution,
  actualDistribution,
  title = "Intensity Distribution",
}: IntensityDistributionProps) {
  // Merge target and actual by zone
  const zones = targetDistribution.map((target) => {
    const actual = actualDistribution.find((a) => a.zone === target.zone);
    return {
      zone: target.zone,
      targetPercentage: target.targetPercentage,
      actualPercentage: actual?.actualPercentage || 0,
      color: target.color,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold tracking-wide uppercase text-muted">
          {title}
        </h4>
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider">
          <span className="text-muted">Target</span>
          <span className="text-text">·</span>
          <span className="text-orange-bright">Actual</span>
        </div>
      </div>

      {/* Stacked bars comparison */}
      <div className="space-y-3">
        {/* Target bar */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
            Target Distribution
          </p>
          <div className="flex h-6 rounded-lg overflow-hidden border border-border">
            {zones.map((zone, idx) => (
              <div
                key={`target-${zone.zone}`}
                className={`relative ${idx === 0 ? "" : "border-l border-white/20"}`}
                style={{
                  width: `${zone.targetPercentage}%`,
                  backgroundColor: `var(--color-${zone.color})`,
                  opacity: 0.5,
                }}
                title={`${zone.zone}: ${zone.targetPercentage}%`}
              >
                {zone.targetPercentage >= 10 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                    {Math.round(zone.targetPercentage)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actual bar */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-bright mb-1.5">
            Actual Distribution
          </p>
          <div className="flex h-6 rounded-lg overflow-hidden border border-border">
            {zones.map((zone, idx) => (
              <div
                key={`actual-${zone.zone}`}
                className={`relative ${idx === 0 ? "" : "border-l border-white/20"}`}
                style={{
                  width: `${zone.actualPercentage}%`,
                  backgroundColor: `var(--color-${zone.color})`,
                }}
                title={`${zone.zone}: ${zone.actualPercentage}%`}
              >
                {zone.actualPercentage >= 10 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                    {Math.round(zone.actualPercentage)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2">
        {zones.map((zone) => (
          <div
            key={`legend-${zone.zone}`}
            className="flex items-center gap-1.5"
          >
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `var(--color-${zone.color})` }}
            />
            <span className="text-[10px] font-semibold text-text">
              {zone.zone}
            </span>
          </div>
        ))}
      </div>

      {/* Compliance check */}
      {(() => {
        const deviations = zones.map((z) => ({
          zone: z.zone,
          diff: Math.abs(z.actualPercentage - z.targetPercentage),
        }));
        const totalDeviation =
          deviations.reduce((sum, d) => sum + d.diff, 0) / 2; // Divide by 2 to avoid double-counting
        const isCompliant = totalDeviation < 10; // Within 10 percentage points total

        return (
          <div
            className={`text-xs p-3 rounded-lg border ${
              isCompliant
                ? "bg-teal/10 border-teal/30 text-teal"
                : "bg-orange/10 border-orange/30 text-orange"
            }`}
          >
            {isCompliant ? (
              <span className="font-semibold">
                ✓ Distribution aligned with prescribed zones
              </span>
            ) : (
              <span className="font-semibold">
                ⚠ Distribution deviating from target zones (+
                {Math.round(totalDeviation)}% difference)
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
