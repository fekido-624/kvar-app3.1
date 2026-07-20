import type {Metadata, Viewport} from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { PwaRegister } from '@/components/pwa-register';

export const metadata: Metadata = {
  title: 'KVar3.1 | Secure Access Management',
  description: 'Professional user management and access control platform.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KVar3.1',
  },
};

export const viewport: Viewport = {
  themeColor: '#7b2d3a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
        <PwaRegister />
      </body>
    </html>
  );
}