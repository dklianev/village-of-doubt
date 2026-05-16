import type { Metadata } from "next";

export const SITE_NAME = "Върколак и Мафия";
export const SITE_TAGLINE = "Социална игра на сенки";

export function resolveSiteUrl(): string {
  const candidate = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;

  if (process.env.NODE_ENV === "production" && !candidate) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL или BETTER_AUTH_URL трябва да са зададени в production среда. Иначе social media preview-та и абсолютните URLs ще сочат към localhost.",
    );
  }

  return candidate ?? "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

interface RouteMetadataOptions {
  title: string;
  description: string;
  path: string;
  image: string;
  imageAlt: string;
  ogTitle?: string;
  ogDescription?: string;
  type?: "website" | "article";
  robots?: Metadata["robots"];
  absoluteTitle?: boolean;
}

export function routeMetadata(options: RouteMetadataOptions): Metadata {
  const url = absoluteUrl(options.path);
  const imageUrl = absoluteUrl(options.image);
  const title = options.ogTitle ?? options.title;
  const description = options.ogDescription ?? options.description;

  return {
    title: options.absoluteTitle ? { absolute: options.title } : options.title,
    description: options.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: options.imageAlt }],
      locale: "bg_BG",
      type: options.type ?? "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    robots: options.robots,
  };
}

export interface JsonLdScript {
  "@context": string;
  "@type": string | string[];
  [key: string]: unknown;
}

export function jsonLdScriptTag(data: JsonLdScript): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
