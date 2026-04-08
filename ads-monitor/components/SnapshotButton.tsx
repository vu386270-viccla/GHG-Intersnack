"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";

interface Props {
  targetRef: React.RefObject<HTMLElement | null>;
  accountId: string;
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
  };
}

export default function SnapshotButton({ targetRef, accountId, metrics }: Props) {
  const [status, setStatus] = useState<"idle" | "capturing" | "uploading" | "done" | "error">("idle");
  const [driveUrl, setDriveUrl] = useState<string>("");

  async function takeSnapshot() {
    if (!targetRef.current) return;
    setStatus("capturing");

    try {
      const dataUrl = await toPng(targetRef.current, { quality: 0.95, pixelRatio: 2 });
      setStatus("uploading");

      const res = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          imageBase64: dataUrl,
          metrics,
          campaignName: `Account ${accountId}`,
        }),
      });

      if (!res.ok) throw new Error("Upload failed");
      const { snapshot } = await res.json();
      setDriveUrl(snapshot.driveUrl);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 5000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const labels = {
    idle: "Chụp ảnh",
    capturing: "Đang chụp...",
    uploading: "Đang upload Drive...",
    done: "Xong!",
    error: "Lỗi, thử lại",
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={takeSnapshot}
        disabled={status !== "idle"}
        className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
      >
        <span>📸</span>
        <span>{labels[status]}</span>
      </button>
      {status === "done" && driveUrl && (
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          Xem trên Drive
        </a>
      )}
    </div>
  );
}
