import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'הזמנות חתונה בוואטסאפ',
  description: 'שליחת הזמנות חתונה בוואטסאפ ומעקב אישורי הגעה, מהמחשב שלכם.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f4fb' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1622' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning className={heebo.variable}>
      {/*
        Antivirus and privacy extensions (Bitdefender's `bis_register`, among
        others) stamp attributes onto <body> before React hydrates, which reads
        as a server/client mismatch. Nothing we render here is non-deterministic.
      */}
      <body className="aurora min-h-dvh antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
