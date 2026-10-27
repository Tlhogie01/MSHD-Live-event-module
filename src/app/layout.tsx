import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "MSHD Events", description: "Manage and publish MSHD events." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
