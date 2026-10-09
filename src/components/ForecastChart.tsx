"use client";

import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Forecast } from "@/lib/types";

// "6:30 PM" -> "6:30p", matching the planner's hour labels.
function compactClock(clock: string): string {
  return clock.toLowerCase().replace(/\s?([ap])m/, "$1");
}

export function ForecastChart({ forecast }: { forecast: Forecast }) {
  const data = forecast.points
    .filter((p) => p.minutes != null)
    .map((p) => ({
      clock: compactClock(p.clock),
      minutes: p.minutes as number,
      offsetMin: p.offsetMin,
    }));

  if (data.length < 2) return null;
  const best = forecast.best;
  const mins = data.map((d) => d.minutes);
  const min = Math.min(...mins);
  const max = Math.max(...mins);
  const clear = forecast.freeFlow;

  // Nothing worth charting: say so in a line and keep a small sparkline.
  if (max - min < 3) {
    return (
      <div>
        <p className="mt-1 text-[15px] font-medium text-slate-800 dark:text-slate-100">
          Steady at {min === max ? `${min}` : `${min} to ${max}`} min until {data[data.length - 1].clock}.
        </p>
        <div className="mt-2 h-10 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <YAxis hide domain={[Math.min(min, clear ?? min) - 1, Math.max(max + 2, min + 8)]} />
              <Area type="monotone" dataKey="minutes" stroke="#0284c7" strokeWidth={2} fill="#0ea5e91a" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // A fixed minimum span (8 min) keeps a one-minute wobble from drawing as a cliff.
  const lo = Math.max(0, Math.floor(Math.min(min, clear ?? min) - 1));
  const hi = Math.max(max + 2, lo + 8);

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
            domain={[lo, hi]}
            tickCount={4}
            allowDecimals={false}
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
          {clear != null && (
            <ReferenceLine
              y={clear}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{ value: "clear run", position: "insideBottomRight", fontSize: 10, fill: "#94a3b8" }}
            />
          )}
          {best?.minutes != null && (
            <ReferenceDot
              x={compactClock(best.clock)}
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
