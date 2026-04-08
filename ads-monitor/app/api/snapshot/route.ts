import { NextRequest, NextResponse } from "next/server";
import { uploadSnapshot } from "@/lib/google-drive";
import { getAccount, saveSnapshot } from "@/lib/store";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, imageBase64, metrics, campaignName } = body;

    if (!accountId || !imageBase64) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account || !account.refreshToken) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Convert base64 to buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    const now = new Date();
    const fileName = `${format(now, "yyyy-MM-dd_HH-mm")}.png`;
    const folderName = campaignName || `Account ${accountId}`;

    const { fileId, webViewLink } = await uploadSnapshot(
      account.refreshToken,
      imageBuffer,
      fileName,
      folderName
    );

    const snapshot = {
      id: `${accountId}_${Date.now()}`,
      accountId,
      driveFileId: fileId,
      driveUrl: webViewLink,
      takenAt: now.toISOString(),
      metrics: metrics || { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
    };

    saveSnapshot(snapshot);

    return NextResponse.json({ snapshot });
  } catch (err) {
    console.error("Snapshot error:", err);
    return NextResponse.json({ error: "Failed to take snapshot" }, { status: 500 });
  }
}
