import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NegotiateAI — Get better deals on stays",
  description: "AI agent that negotiates Airbnb prices on your behalf",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full">
        <div className="relative max-w-[430px] mx-auto min-h-dvh bg-white shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
