type PreloadImage = string | {
  href: string;
  media?: string;
  type?: string;
  fetchPriority?: "high" | "low" | "auto";
};

export function ResourceHints({
  images = [],
  preconnect = [],
}: {
  images?: readonly PreloadImage[];
  preconnect?: readonly string[];
}) {
  return (
    <>
      {preconnect.map((href) => (
        <link key={href} rel="preconnect" href={href} />
      ))}
      {images.map((image) => {
        if (typeof image === "string") {
          return null;
        }

        const { href, media, fetchPriority } = image;
        const type = image.type ?? "image/webp";
        return (
          <link
            key={`${href}:${media ?? ""}`}
            rel="preload"
            as="image"
            href={href}
            type={type}
            {...(media ? { media } : {})}
            {...(fetchPriority ? { fetchPriority } : {})}
          />
        );
      })}
    </>
  );
}
