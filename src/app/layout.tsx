import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import "./globals.css";
import { DEFAULT_LOCALE, DICTS, dirOf, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n";
import { AppProvider } from "@/components/AppProvider";
import { getSession } from "@/server/auth";

const dm = localFont({ src: "../fonts/DMSans.ttf", variable: "--font-dm", weight: "100 1000", display: "swap" });
const readex = localFont({ src: "../fonts/ReadexPro.ttf", variable: "--font-readex", weight: "160 700", display: "swap" });

async function currentLocale(): Promise<Locale> {
  const raw = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = DICTS[await currentLocale()];
  return {
    title: t.meta.title,
    description: t.meta.description,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/brand/plassa-icon-primary.svg", apple: "/brand/plassa-icon-primary.png" },
    appleWebApp: { capable: true, title: "Plassa", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: "#1E4BFF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await currentLocale();
  const s = await getSession();
  const user = s ? { id: s.userId, role: s.role, name: s.name } : null;
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${dm.variable} ${readex.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppProvider initialLocale={locale} initialUser={user}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
