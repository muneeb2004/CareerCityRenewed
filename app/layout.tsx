import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://career-city.vercel.app'),
  title: 'HU Career City',
  description: 'HU Career City 2026 - Career Fair Management System',
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
        <Toaster position="top-center" />
        {children}
      </body>
    </html>
  );
}
