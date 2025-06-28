import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from './context/AuthContext';
import VersionNumber from './components/VersionNumber';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Citrus Host - Web Hosting & Domain Management",
  description: "Premium web hosting and domain management services by Citrus Host",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ec4899",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#ec4899" />
        <meta name="msapplication-navbutton-color" content="#ec4899" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <VersionNumber />
        </AuthProvider>
      </body>
    </html>
  );
}
