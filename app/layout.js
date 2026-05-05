import "./globals.css";
import { Cormorant_Garamond, Inter } from "next/font/google";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display"
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata = {
  title: "Mapping the Rhythm of Crime in Chicago: A Storytelling Visualization of Space, Time, and Offense Patterns in 2025",
  description:
    "An interactive storytelling visualization of Chicago crime patterns across districts, months, and offense types in 2025."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
