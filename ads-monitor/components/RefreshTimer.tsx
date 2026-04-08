"use client";

import { useEffect, useState, useCallback } from "react";

interface Props {
  intervalMs?: number; // default 15 min
  onRefresh: () => Promise<void>;
}

export default function RefreshTimer({ intervalMs = 15 * 60 * 1000, onRefresh }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(intervalMs / 1000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
      setSecondsLeft(intervalMs / 1000);
    }
  }, [onRefresh, intervalMs]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          doRefresh();
          return intervalMs / 1000;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(countdown);
  }, [doRefresh, intervalMs]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex items-center gap-3 text-sm text-gray-500">
      <span className="text-xs">
        Cập nhật lúc {lastRefreshed.toLocaleTimeString("vi-VN")}
      </span>
      <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full">
        {isRefreshing ? (
          <>
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-blue-600 font-medium text-xs">Đang tải...</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-mono text-xs">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
          </>
        )}
      </div>
      <button
        onClick={doRefresh}
        disabled={isRefreshing}
        className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50"
      >
        Làm mới
      </button>
    </div>
  );
}
