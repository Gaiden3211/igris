import type {Metadata, Viewport} from 'next';
import './globals.css';
import {Providers} from './providers';
import {Shell} from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Igris — research data, answered with sources',
  description: 'Search, compare and understand microgravity investigations with an assistant that cites every source.',
};
export const viewport: Viewport = {width: 'device-width', initialScale: 1, viewportFit: 'cover'};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" data-glow="mono" suppressHydrationWarning>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
