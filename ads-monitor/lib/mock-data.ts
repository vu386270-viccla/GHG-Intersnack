export interface Campaign {
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED" | "REMOVED";
  impressions: number;
  clicks: number;
  spend: number; // USD
  conversions: number;
  ctr: number; // %
  cpc: number; // USD
  roas: number;
}

export interface Account {
  id: string;
  name: string;
  currency: string;
  accessToken?: string;
  refreshToken?: string;
  campaigns?: Campaign[];
  connectedAt?: string;
}

export interface Snapshot {
  id: string;
  accountId: string;
  campaignId?: string;
  driveFileId: string;
  driveUrl: string;
  takenAt: string;
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
  };
}

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "111",
    name: "Search - Brand Keywords",
    status: "ENABLED",
    impressions: 302000,
    clicks: 4930,
    spend: 1460.5,
    conversions: 309,
    ctr: 1.63,
    cpc: 0.3,
    roas: 4.2,
  },
  {
    id: "222",
    name: "Performance Max - All Products",
    status: "ENABLED",
    impressions: 850000,
    clicks: 12400,
    spend: 3200.0,
    conversions: 890,
    ctr: 1.46,
    cpc: 0.26,
    roas: 5.8,
  },
  {
    id: "333",
    name: "Display - Remarketing",
    status: "PAUSED",
    impressions: 1200000,
    clicks: 3600,
    spend: 420.0,
    conversions: 45,
    ctr: 0.3,
    cpc: 0.12,
    roas: 2.1,
  },
  {
    id: "444",
    name: "Search - Competitor",
    status: "ENABLED",
    impressions: 95000,
    clicks: 2100,
    spend: 980.0,
    conversions: 120,
    ctr: 2.21,
    cpc: 0.47,
    roas: 3.5,
  },
];

export const MOCK_CHART_DATA = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
    impressions: Math.floor(80000 + Math.random() * 40000),
    clicks: Math.floor(1500 + Math.random() * 1000),
    spend: parseFloat((300 + Math.random() * 200).toFixed(2)),
    conversions: Math.floor(50 + Math.random() * 60),
  };
});
