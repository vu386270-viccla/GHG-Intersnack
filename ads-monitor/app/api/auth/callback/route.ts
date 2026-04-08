import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-auth";
import { getAccessibleCustomers } from "@/lib/google-ads";
import { saveAccount } from "@/lib/store";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?error=access_denied", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Missing tokens");
    }

    // Get list of accessible customer accounts
    const customerIds = await getAccessibleCustomers(tokens.access_token);

    // Save each account
    for (const customerId of customerIds) {
      saveAccount({
        id: customerId,
        name: `Account ${customerId}`,
        currency: "USD",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        connectedAt: new Date().toISOString(),
      });
    }

    const firstId = customerIds[0] || "";
    return NextResponse.redirect(
      new URL(`/dashboard?accountId=${firstId}`, req.url)
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }
}
