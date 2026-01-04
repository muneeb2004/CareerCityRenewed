import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import CameraCleanup from '../src/components/CameraCleanup';
import { OfflineIndicator } from '@/lib/components/ui/OfflineIndicator';
import { WebVitalsReporter } from '@/lib/components/ui/WebVitalsReporter';
import './globals.css';
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  themeColor: '#5B2C6F',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://career-city.vercel.app'),
  title: 'HU Career City',
  description: 'HU Career City 2026 - Career Fair Management System',
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    images: '/HU-Logo.png',
  },
  twitter: {
    images: ['/HU-Logo.png'],
    card: 'summary_large_image',
  },
  icons: {
    icon: '/favicon-optimized.png',
    shortcut: '/favicon-optimized.png',
    apple: '/favicon-optimized.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <CameraCleanup />
        <Toaster position="top-center" />
        <OfflineIndicator />
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
