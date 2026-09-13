import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Сенките: Върколак и Мафия",
    short_name: "Сенките",
    description: "Тайни роли, частни стаи и български правила за Върколак и Мафия.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1114",
    theme_color: "#842f2b",
    lang: "bg",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Върколак",
        short_name: "Върколак",
        description: "Отвори играта Върколак.",
        url: "/werewolf",
      },
      {
        name: "Мафия",
        short_name: "Мафия",
        description: "Отвори играта Мафия.",
        url: "/mafia",
      },
    ],
  };
}
