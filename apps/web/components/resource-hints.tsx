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
        const href = typeof image === "string" ? image : image.href;
        const media = typeof image === "string" ? undefined : image.media;
        const type = typeof image === "string" ? "image/webp" : (image.type ?? "image/webp");
        const fetchPriority = typeof image === "string" ? undefined : image.fetchPriority;
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
