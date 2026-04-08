import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GHG Tracker — Intersnack Group',
  description: 'Greenhouse Gas Emissions Tracking Dashboard following SBTi Science Based Targets for Intersnack Group factories. Track Scope 1, 2, and 3 emissions.',
  keywords: 'GHG, emissions, Intersnack, SBTi, scope 1, scope 2, scope 3, carbon tracking',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <div className="app-layout">
          <Sidebar />
          <Header />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
