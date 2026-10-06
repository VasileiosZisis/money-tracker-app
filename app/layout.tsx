import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { getSiteMetadata } from "@/lib/site/metadata";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  display: "swap",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...getSiteMetadata(process.env.VERCEL_ENV),
  icons: {
    icon: [
      { url: "/branding/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/branding/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/branding/favicons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/branding/favicons/site.webmanifest",
};

const themeScript = `
  try {
    const storedTheme = window.localStorage.getItem("money-tracker-theme");
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const resolvedTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : systemTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.dataset.theme = resolvedTheme;
  } catch (error) {
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
  }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <Toaster
          closeButton
          duration={4000}
          mobileOffset={{ top: "5.5rem", right: "1rem" }}
          offset={{ top: "5.5rem", right: "1rem" }}
          position="top-right"
          richColors
          visibleToasts={3}
        />
      </body>
    </html>
  );
}
