"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MetricCard from "@/components/MetricCard";
import CampaignTable from "@/components/CampaignTable";
import CampaignChart from "@/components/CampaignChart";
import RefreshTimer from "@/components/RefreshTimer";
import SnapshotButton from "@/components/SnapshotButton";
import { Campaign } from "@/lib/mock-data";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}N`;
  return n.toLocaleString();
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId") || "";
  const isMock = searchParams.get("mock") === "true";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMockData, setIsMockData] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const fetchCampaigns = useCallback(async () => {
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    if (isMock) params.set("mock", "true");

    const res = await fetch(`/api/campaigns?${params}`);
    const data = await res.json();
    setCampaigns(data.campaigns || []);
    setIsMockData(data.mock);
    setLoading(false);
  }, [accountId, isMock]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      spend: acc.spend + c.spend,
      conversions: acc.conversions + c.conversions,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
  );

  const avgCtr = totals.impressions > 0
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
    : "0";
  const avgCpc = totals.clicks > 0
    ? (totals.spend / totals.clicks).toFixed(2)
    : "0";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                A
              </div>
              <span className="font-semibold text-gray-800">Ads Monitor</span>
            </a>
            {accountId && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-sm text-gray-500">ID: {accountId}</span>
              </>
            )}
            {isMockData && (
              <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
                Demo data
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <SnapshotButton
              targetRef={dashboardRef}
              accountId={accountId || "demo"}
              metrics={totals}
            />
            <RefreshTimer onRefresh={fetchCampaigns} />
          </div>
        </div>
      </header>

      {/* Dashboard content */}
      <main className="max-w-7xl mx-auto px-4 py-6" ref={dashboardRef}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 text-sm">Đang tải dữ liệu...</div>
          </div>
        ) : (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <MetricCard
                label="Lượt hiển thị"
                value={fmt(totals.impressions)}
                color="blue"
                icon="👁"
              />
              <MetricCard
                label="Lượt nhấp"
                value={fmt(totals.clicks)}
                color="red"
                icon="🖱"
              />
              <MetricCard
                label="CTR"
                value={`${avgCtr}%`}
                color="gray"
                icon="📈"
              />
              <MetricCard
                label="Chi phí ($)"
                value={`$${totals.spend.toLocaleString()}`}
                color="yellow"
                icon="💰"
              />
              <MetricCard
                label="CPC ($)"
                value={`$${avgCpc}`}
                color="gray"
                icon="💲"
              />
              <MetricCard
                label="Chuyển đổi"
                value={fmt(totals.conversions)}
                color="green"
                icon="✅"
              />
            </div>

            {/* Chart */}
            <div className="mb-6">
              <CampaignChart activeMetric="clicks" />
            </div>

            {/* Campaign table */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Campaigns ({campaigns.length})
              </h2>
              <CampaignTable campaigns={campaigns} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Đang tải...
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
