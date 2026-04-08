"use client";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "red" | "green" | "yellow" | "gray";
  icon?: string;
}

const colors = {
  blue: "bg-blue-600 text-white",
  red: "bg-red-500 text-white",
  green: "bg-green-600 text-white",
  yellow: "bg-yellow-400 text-gray-900",
  gray: "bg-white text-gray-800 border border-gray-200",
};

export default function MetricCard({ label, value, sub, color = "gray", icon }: MetricCardProps) {
  return (
    <div className={`rounded-xl p-5 shadow-sm ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium opacity-80">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
    </div>
  );
}
