export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "IPO Tracker",
  description: "Track IPO investments and profit-sharing settlements",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen bg-[#0f0f1a]">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 min-h-screen">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </body>
    </html>
  );
}
