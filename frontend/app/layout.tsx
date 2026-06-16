import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ScenarioProvider } from "../providers/ScenarioProvider";
import ToastContainer from "../components/ToastContainer";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GridOps Copilot",
  description: "AI operations copilot for renewable energy incident triage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-[#F8FAFC] text-[#0F172A]">
        <ScenarioProvider>
          {children}
          <ToastContainer />
        </ScenarioProvider>
      </body>
    </html>
  );
}

