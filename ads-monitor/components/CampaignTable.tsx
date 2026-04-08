"use client";

import { Campaign } from "@/lib/mock-data";

interface Props {
  campaigns: Campaign[];
}

const statusBadge: Record<string, string> = {
  ENABLED: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  REMOVED: "bg-gray-100 text-gray-500",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function CampaignTable({ campaigns }: Props) {
  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      spend: acc.spend + c.spend,
      conversions: acc.conversions + c.conversions,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Campaign</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Impressions</th>
              <th className="text-right px-4 py-3">Clicks</th>
              <th className="text-right px-4 py-3">CTR</th>
              <th className="text-right px-4 py-3">Spend ($)</th>
              <th className="text-right px-4 py-3">CPC ($)</th>
              <th className="text-right px-4 py-3">Conversions</th>
              <th className="text-right px-4 py-3">ROAS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">
                  {c.name}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[c.status]}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(c.impressions)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(c.clicks)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{c.ctr.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">
                  ${c.spend.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">${c.cpc.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(c.conversions)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-medium ${c.roas >= 3 ? "text-green-600" : c.roas >= 1.5 ? "text-yellow-600" : "text-red-500"}`}>
                    {c.roas.toFixed(2)}x
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold text-gray-700 text-xs">
            <tr>
              <td className="px-4 py-3" colSpan={2}>Total</td>
              <td className="px-4 py-3 text-right">{fmt(totals.impressions)}</td>
              <td className="px-4 py-3 text-right">{fmt(totals.clicks)}</td>
              <td className="px-4 py-3 text-right">
                {totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : 0}%
              </td>
              <td className="px-4 py-3 text-right">${totals.spend.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                ${totals.clicks > 0 ? (totals.spend / totals.clicks).toFixed(2) : "0.00"}
              </td>
              <td className="px-4 py-3 text-right">{fmt(totals.conversions)}</td>
              <td className="px-4 py-3 text-right">
                {totals.spend > 0 ? (totals.conversions / totals.spend).toFixed(2) : 0}x
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
