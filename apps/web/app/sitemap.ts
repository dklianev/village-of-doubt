import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/werewolf"), lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/mafia"), lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/werewolf/roles"), lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/mafia/roles"), lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/roles"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/werewolf/rules"), lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/mafia/rules"), lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/tutorial"), lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/faq"), lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/leaderboard"), lastModified, changeFrequency: "daily", priority: 0.5 },
    { url: absoluteUrl("/history"), lastModified, changeFrequency: "daily", priority: 0.5 },
    { url: absoluteUrl("/achievements"), lastModified, changeFrequency: "weekly", priority: 0.5 },
    { url: absoluteUrl("/sign-in"), lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: absoluteUrl("/privacy"), lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/terms"), lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/status"), lastModified, changeFrequency: "always", priority: 0.3 },
  ];
}
