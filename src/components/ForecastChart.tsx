"use client";

import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Forecast } from "@/lib/types";

export function ForecastChart({ forecast }: { forecast: Forecast }) {
  const data = forecast.points
    .filter((p) => p.minutes != null)
    .map((p) => ({
      clock: p.clock,
      minutes: p.minutes as number,
      offsetMin: p.offsetMin,
    }));

  if (data.length < 2) return null;
  const best = forecast.best;

  return (
    <div className="h-56 w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 14, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="bw-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="clock"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={28}
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={42}
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
            domain={["dataMin - 2", "dataMax + 2"]}
            tickFormatter={(v) => `${v}m`}
          />
          <Tooltip
            formatter={(v) => [`${v} min`, "Drive"]}
            labelFormatter={(l) => `Leave ${l}`}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.3)",
              fontSize: 12,
              padding: "6px 10px",
            }}
          />
          <Area
            type="monotone"
            dataKey="minutes"
            stroke="#0284c7"
            strokeWidth={2.5}
            fill="url(#bw-area)"
            isAnimationActive={false}
          />
          {best?.minutes != null && (
            <ReferenceDot
              x={best.clock}
              y={best.minutes}
              r={5}
              fill="#16a34a"
              stroke="#fff"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
