import { ReactNode } from 'react';
import type { Metadata } from 'next';
import LocalFont from 'next/font/local';
import '../global.css';
import data from '../data.json' with { type: 'json' };

const username = process.env.GITHUB_USERNAME || data.githubUsername;
const displayName = data.displayName || username;

export const metadata: Metadata = {
  title: {
    default: `${username}'s portfolio`,
    template: `%s | ${data.displayName}'s portfolio`,
  },
  description: `GitHub portfolio for ${displayName}`,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: [
    {
      url: '/favicon.ico',
      rel: 'icon',
      sizes: 'any',
      type: 'image/x-icon',
    },
  ],
};

const calSans = LocalFont({
  src: '../public/fonts/CalSans-SemiBold-latin.woff2',
  variable: '--font-calsans',
  display: 'swap',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={calSans.variable}>
      <body
        className={`bg-black ${
          process.env.NODE_ENV === 'development' ? 'debug-screens' : ''
        }`}
      >
        {children}
      </body>
    </html>
  );
}
