import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/lib/auth/session-context';

export const metadata: Metadata = {
  title: 'AssetX — Enterprise Asset Management',
  description: 'Enterprise Asset Lifecycle Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
