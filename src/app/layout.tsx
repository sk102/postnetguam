import type { Metadata } from 'next';
import { Roboto, Roboto_Slab, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-roboto',
});

const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-roboto-slab',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'PostNet Customer Management',
  description: 'Customer management system for PostNet mailbox rentals',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="en">
      <body className={`${roboto.className} ${robotoSlab.variable} ${ibmPlexMono.variable}`}>{children}</body>
    </html>
  );
}
