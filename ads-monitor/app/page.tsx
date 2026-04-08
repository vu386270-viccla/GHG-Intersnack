import Link from "next/link";

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <span className="text-2xl font-bold text-gray-800">Ads Monitor</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Theo dõi campaign Google Ads
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Dashboard realtime — impressions, clicks, spend, conversions.
          Tự động cập nhật mỗi 15 phút và lưu ảnh lên Google Drive.
        </p>

        {/* Connect button */}
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 w-full bg-white border border-gray-200 rounded-xl px-6 py-4 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm mb-4"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Kết nối Google Ads Account
        </a>

        {/* Demo mode */}
        <Link
          href="/dashboard?mock=true"
          className="block w-full text-center text-sm text-blue-600 hover:text-blue-800 py-2"
        >
          Xem demo với dữ liệu mẫu →
        </Link>

        {/* Features */}
        <div className="mt-12 grid grid-cols-2 gap-3 text-left">
          {[
            { icon: "🔄", text: "Tự động refresh 15 phút" },
            { icon: "📸", text: "Chụp & lưu lên Google Drive" },
            { icon: "📊", text: "Chart theo dõi xu hướng" },
            { icon: "👥", text: "Nhiều account MCC" },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
              <span className="text-lg">{f.icon}</span>
              <span className="text-xs text-gray-600">{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
