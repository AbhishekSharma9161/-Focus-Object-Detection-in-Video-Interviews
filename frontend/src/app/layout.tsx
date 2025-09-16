import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "Focus & Object Detection in Video Interviews",
  description: "Real-time proctoring and object detection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
