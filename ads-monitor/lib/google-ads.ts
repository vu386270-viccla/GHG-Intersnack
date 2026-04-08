import { Campaign } from "./mock-data";

const ADS_API_BASE = "https://googleads.googleapis.com/v18";

export async function getAccessibleCustomers(accessToken: string): Promise<string[]> {
  const res = await fetch(`${ADS_API_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    },
  });
  if (!res.ok) throw new Error(`Google Ads API error: ${res.statusText}`);
  const data = await res.json();
  // Returns resource names like "customers/1234567890"
  return (data.resourceNames || []).map((r: string) => r.replace("customers/", ""));
}

export async function getCampaigns(
  accessToken: string,
  customerId: string
): Promise<Campaign[]> {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.value_per_conversion
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;

  const res = await fetch(`${ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
      "login-customer-id": process.env.GOOGLE_ADS_MCC_ID?.replace(/-/g, "") || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google Ads API error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const rows = data.results || [];

  return rows.map((row: Record<string, unknown>) => {
    const campaign = row.campaign as Record<string, unknown>;
    const metrics = row.metrics as Record<string, unknown>;
    const spend = Number(metrics.costMicros || 0) / 1_000_000;
    const clicks = Number(metrics.clicks || 0);
    const impressions = Number(metrics.impressions || 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = Number(metrics.averageCpc || 0) / 1_000_000;
    const conversions = Number(metrics.conversions || 0);

    return {
      id: String(campaign.id),
      name: String(campaign.name),
      status: String(campaign.status) as Campaign["status"],
      impressions,
      clicks,
      spend: parseFloat(spend.toFixed(2)),
      conversions: Math.round(conversions),
      ctr: parseFloat(ctr.toFixed(2)),
      cpc: parseFloat(cpc.toFixed(2)),
      roas: spend > 0 ? parseFloat((conversions / spend).toFixed(2)) : 0,
    };
  });
}
