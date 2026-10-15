import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/lib/auth/session-context';
import { I18nProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { ThemeProvider } from '@/lib/theme';
import { IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';

// Self-hosted by Next at build time (no runtime request to Google).
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-plex-arabic', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'AssetX — إدارة الأصول المؤسسية',
  description: 'منصة إدارة دورة حياة الأصول للمؤسسات',
};

// Runs before the first paint so the page never flashes English/LTR or the wrong theme.
// Keys and dark-theme ids mirror lib/i18n.tsx (LANG_KEY) and lib/theme.tsx (THEME_KEY).
const PRE_PAINT_SCRIPT = `(function(){try{
var d=document.documentElement;
var l=localStorage.getItem('assetx.lang.v1')==='en'?'en':'ar';
d.lang=l;d.dir=l==='ar'?'rtl':'ltr';
var t=localStorage.getItem('assetx.theme.v1');
if(['enterprise','midnight','emerald','graphite'].indexOf(t)<0)t='enterprise';
var dark=t==='midnight'||t==='graphite';
d.dataset.theme=t;d.classList.toggle('dark',dark);d.style.colorScheme=dark?'dark':'light';
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plexArabic.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          <SessionProvider>
            <I18nProvider>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
            </I18nProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
