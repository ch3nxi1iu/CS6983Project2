import type { Metadata } from "next";
import { Suspense } from "react";
import { Schibsted_Grotesk } from "next/font/google";
import AppHeader from "@/components/AppHeader";
import "./globals.css";

const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Loadline",
  description: "Turn Canvas deadlines into a weekly workload forecast and a work plan.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className={schibstedGrotesk.className}>
        <Suspense fallback={null}>
          <AppHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
