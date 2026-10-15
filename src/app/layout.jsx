import './globals.css';
export const metadata = {
  title: 'Miles Mossop Wine Club',
  description: 'Miles Mossop Family Wine Club',
  manifest: '/manifest.json',
  // NOT a standalone web app on purpose: standalone PWAs get isolated storage on
  // iOS, so a magic-link login (which opens in Safari) never reaches the installed
  // app. Opening in the browser shares Safari's session, so sign-in works.
  appleWebApp: { capable: false },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};
export const viewport = {
  themeColor: '#141414',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
