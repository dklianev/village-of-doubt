import localFont from "next/font/local";

export const displayFont = localFont({
  src: "./fonts/literata-reading.woff2",
  variable: "--font-literata",
  weight: "400 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const interfaceFont = localFont({
  src: "./fonts/sofia-sans-interface.woff2",
  variable: "--font-sofia",
  weight: "400 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
});
