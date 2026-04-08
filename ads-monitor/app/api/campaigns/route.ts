import { NextRequest, NextResponse } from "next/server";
import { getCampaigns } from "@/lib/google-ads";
import { getAccount } from "@/lib/store";
import { refreshAccessToken } from "@/lib/google-auth";
import { MOCK_CAMPAIGNS } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");
  const useMock = req.nextUrl.searchParams.get("mock") === "true";

  if (useMock || !accountId) {
    return NextResponse.json({ campaigns: MOCK_CAMPAIGNS, mock: true });
  }

  const account = getAccount(accountId);
  if (!account || !account.refreshToken) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    // Refresh token to ensure it's valid
    const accessToken = await refreshAccessToken(account.refreshToken);
    if (!accessToken) throw new Error("Failed to refresh token");

    const campaigns = await getCampaigns(accessToken, accountId);
    return NextResponse.json({ campaigns, mock: false });
  } catch (err) {
    console.error("Failed to fetch campaigns:", err);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}
