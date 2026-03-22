import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoteForge — AI Study Tools",
  description: "Turn your notes into flashcards, quizzes, and more instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}