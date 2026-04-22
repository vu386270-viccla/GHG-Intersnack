import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ChatBot from '@/components/layout/ChatBot';
import { AuthProvider } from '@/lib/auth-context';
import AppProgressBar from '@/components/layout/AppProgressBar';
import { I18nProvider } from '@/lib/i18n';

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
    <html lang="en">
      <body>
        <I18nProvider>
          <AuthProvider>
            <div className="app-layout">
              <Sidebar />
              <Header />
              <main className="main-content">
                {children}
              </main>
              <ChatBot />
              <AppProgressBar />
            </div>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
