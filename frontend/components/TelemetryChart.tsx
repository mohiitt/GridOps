"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend
} from "recharts";
import { formatTimeOnly } from "../lib/format";

type TelemetryChartProps = {
  title: string;
  metric: string;
  unit: string;
  threshold?: number;
  series: Array<{ timestamp: string; value: number }>;
  comparisonSeries?: Array<{ timestamp: string; value: number }>;
};

export default function TelemetryChart({
  title,
  unit,
  threshold,
  series,
  comparisonSeries
}: TelemetryChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !series || series.length === 0) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm h-64 flex items-center justify-center text-sm text-[#64748B]">
        Loading chart...
      </div>
    );
  }

  // Combine data for Recharts
  const chartData = series.map((item, idx) => {
    const timeStr = formatTimeOnly(item.timestamp);
    const dataObj: any = {
      timestamp: timeStr,
      rawTime: item.timestamp,
      primary: item.value,
    };
    if (comparisonSeries && comparisonSeries[idx]) {
      dataObj.comparison = comparisonSeries[idx].value;
    }
    return dataObj;
  });

  // Calculate accessibility summary
  const generateSummary = () => {
    if (series.length < 2) return "";
    const startVal = series[0].value;
    const endVal = series[series.length - 1].value;
    const diff = endVal - startVal;
    const direction = diff > 0 ? "rose" : diff < 0 ? "dropped" : "remained stable";
    const changeText = diff !== 0 ? `by ${Math.abs(diff).toFixed(1)}${unit}` : "";
    
    let thresholdText = "";
    if (threshold !== undefined) {
      const crossedPoint = series.find(item => item.value > threshold);
      if (crossedPoint) {
        thresholdText = `, crossing the threshold of ${threshold}${unit} at ${formatTimeOnly(crossedPoint.timestamp)}`;
      } else {
        thresholdText = `, remaining below the threshold of ${threshold}${unit}`;
      }
    }

    return `${title} ${direction} from ${startVal}${unit} to ${endVal}${unit} ${changeText}${thresholdText}.`;
  };

  const trendSummary = generateSummary();

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)] hover:border-[#CBD5E1] transition-all duration-200">
      <h3 className="text-sm font-semibold text-[#0F172A] mb-4">{title}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="timestamp"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dx={-5}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle", fill: "#64748B", fontSize: 10 },
                offset: 5,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 4px 12px rgba(15,23,42,0.08)"
              }}
              labelClassName="font-semibold text-[#0F172A]"
            />
            <Line
              type="monotone"
              dataKey="primary"
              name="Measured"
              stroke="#0EA5E9"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
            {comparisonSeries && (
              <Line
                type="monotone"
                dataKey="comparison"
                name="Expected"
                stroke="#94A3B8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
            {threshold !== undefined && (
              <ReferenceLine
                y={threshold}
                stroke="#EF4444"
                strokeDasharray="3 3"
                label={{
                  value: `Limit: ${threshold}${unit}`,
                  position: "top",
                  fill: "#EF4444",
                  fontSize: 10,
                  fontWeight: "bold",
                }}
              />
            )}
            <Legend verticalAlign="top" height={36} iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: "11px", fill: "#334155" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Screen Reader and Accessibility Text */}
      <p className="mt-4 text-xs text-[#64748B] italic bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0]" aria-live="polite">
        <span className="font-semibold not-italic text-[#334155] mr-1.5">Chart Summary:</span>
        {trendSummary}
      </p>
    </div>
  );
}
