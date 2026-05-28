import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'PR Monitor Agent — Agentic PR Intelligence',
  description: 'Claude-powered PR monitoring agent. Aggregates from RSS, Google News, NewsAPI, Bing News, and HTML scraping.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ivory text-ink font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
