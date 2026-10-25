import type { Metadata } from "next";
import { MotionConfig } from "motion/react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swing Desk",
  description: "Swing trading research terminal",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <MotionConfig reducedMotion="user">
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1 p-4">{children}</main>
            </div>
          </div>
        </MotionConfig>
      </body>
    </html>
  );
}
