"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { MOCK_CHART_DATA } from "@/lib/mock-data";

const METRICS = [
  { key: "impressions", label: "Impressions", color: "#1a73e8" },
  { key: "clicks", label: "Clicks", color: "#ea4335" },
  { key: "conversions", label: "Conversions", color: "#34a853" },
] as const;

interface Props {
  activeMetric?: "impressions" | "clicks" | "conversions" | "spend";
}

export default function CampaignChart({ activeMetric = "clicks" }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">30 ngày gần nhất</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={MOCK_CHART_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9aa0a6" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9aa0a6" }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e8eaed",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          />
          {METRICS.map((m) => (
            <Line
              key={m.key}
              type="monotone"
              dataKey={m.key}
              name={m.label}
              stroke={m.color}
              strokeWidth={activeMetric === m.key ? 2.5 : 1.5}
              dot={false}
              opacity={activeMetric === m.key ? 1 : 0.4}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
