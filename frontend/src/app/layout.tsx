import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'CashflowWise — Property Cashflow for Australian Investors',
  description: 'Track property bills, rental income, and cashflow in one place. AI reads your PM statements. Built for Australian property investors. Free to start.',
  keywords: 'property cashflow, investment property tracker, PM statement, Australian property investor, rental income tracker',
  openGraph: {
    title: 'CashflowWise — Know your cashflow before your accountant does',
    description: 'Track every property bill, see your net cashflow at a glance, and let AI pull data from your PM statements. Built for Australian investors.',
    url: 'https://cashflowwise.com.au',
    siteName: 'CashflowWise',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
