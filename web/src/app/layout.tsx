import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/lib/auth/session-context';
import { I18nProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';

export const metadata: Metadata = {
  title: 'AssetX — Enterprise Asset Management',
  description: 'Enterprise Asset Lifecycle Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-screen">
        <SessionProvider>
          <I18nProvider>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
