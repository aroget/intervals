"use client";

import { useState, useEffect } from "react";

interface Block {
  blockNumber: number;
  startDate: string;
  endDate: string;
  effectiveness: number;
  isCurrent: boolean;
}

export default function BlockEffectivenessHistory({
  athleteId,
}: {
  athleteId: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/block-history`,
    )
      .then((r) => r.json())
      .then((data) => {
        setBlocks(data.blocks ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin h-8 w-8 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">
          No historical data yet. Complete your first training block to see
          trends.
        </p>
      </div>
    );
  }

  // Find min/max for scaling
  const values = blocks.map((b) => b.effectiveness);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 20; // Prevent zero range for single block
  const chartMin = Math.max(0, minVal - range * 0.2);
  const chartMax = Math.min(100, maxVal + range * 0.2);
  const chartRange = chartMax - chartMin || 100; // Prevent zero range

  const getY = (value: number) => {
    const normalized = (value - chartMin) / chartRange;
    return 100 - normalized * 100; // Invert for SVG coordinates
  };

  const pathData = blocks
    .map((block, i) => {
      const x = blocks.length > 1 ? (i / (blocks.length - 1)) * 100 : 50; // Center single block
      const y = getY(block.effectiveness);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(" ");

  const avgEffectiveness =
    blocks.reduce((sum, b) => sum + b.effectiveness, 0) / blocks.length;

  const trend =
    blocks.length >= 2
      ? blocks[blocks.length - 1].effectiveness - blocks[0].effectiveness
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg-assistant p-4 rounded-lg border border-border">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted">
            Average
          </p>
          <p className="text-2xl font-bold tabular-nums text-text mt-1">
            {Math.round(avgEffectiveness)}
            <span className="text-sm text-muted">/100</span>
          </p>
        </div>
        <div className="bg-bg-assistant p-4 rounded-lg border border-border">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted">
            Trend
          </p>
          <p
            className={`text-2xl font-bold tabular-nums mt-1 ${
              trend > 0
                ? "text-teal"
                : trend < 0
                  ? "text-orange-bright"
                  : "text-muted"
            }`}
          >
            {trend > 0 ? "+" : ""}
            {Math.round(trend)}
            <span className="text-sm"> pts</span>
          </p>
        </div>
      </div>

      {/* Line Chart */}
      <div className="relative">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-48"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="currentColor"
              strokeWidth="0.2"
              className="text-border"
              opacity="0.5"
            />
          ))}

          {/* Line path - only show if multiple blocks */}
          {blocks.length > 1 && (
            <path
              d={pathData}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-teal"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Data points */}
          {blocks.map((block, i) => {
            const x = blocks.length > 1 ? (i / (blocks.length - 1)) * 100 : 50;
            const y = getY(block.effectiveness);
            return (
              <circle
                key={block.blockNumber}
                cx={x}
                cy={y}
                r="3"
                className={
                  block.isCurrent
                    ? "fill-orange-bright stroke-orange-bright"
                    : "fill-teal stroke-white"
                }
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2">
          {blocks.map((block) => (
            <div
              key={block.blockNumber}
              className="flex flex-col items-center"
              style={{ flex: 1 }}
            >
              <span
                className={`text-xs font-semibold ${
                  block.isCurrent ? "text-orange-bright" : "text-muted"
                }`}
              >
                Block {block.blockNumber}
              </span>
              <span className="text-[10px] text-muted tabular-nums">
                {block.effectiveness}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <div className="bg-bg-assistant p-4 rounded-lg border border-border">
        <p className="text-xs text-text leading-relaxed">
          {blocks[blocks.length - 1].effectiveness >= 75
            ? "🎯 Excellent progress! Your training adaptation is highly effective."
            : blocks[blocks.length - 1].effectiveness >= 50
              ? "📊 Good trajectory. Keep focusing on key session compliance."
              : "⚠️ Training effectiveness could improve. Check compliance and recovery balance."}
        </p>
      </div>
    </div>
  );
}
