import { jsonLdScriptTag, type JsonLdScript } from "@/lib/seo";

export function JsonLd({ data }: { data: JsonLdScript }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScriptTag(data) }}
    />
  );
}
