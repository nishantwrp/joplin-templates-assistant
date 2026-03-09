import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from '@next/third-parties/google'
import "./globals.css";
import frontendConfig from "../frontend_config.json";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Joplin Templates Assistant"
const description = "AI-powered assistant to create & a playground to test your joplin templates"

export const metadata: Metadata = {
  title: title,
  description: description,
  keywords: ["joplin", "templates", "plugin", "ai", "assistant", "playground"],
  openGraph: {
    type: "website",
    url: "https://joplin-templates-assistant.nishantwrp.com",
    title: title,
    description: description,
    siteName: title,
    images: [{ url: "https://joplin-templates-assistant.nishantwrp.com/screenshot.png" }]
  },
  twitter: {
    card: "summary_large_image",
    description: description,
    title: title,
    images: "https://joplin-templates-assistant.nishantwrp.com/screenshot.png"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = frontendConfig.googleAnalyticsId;

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
