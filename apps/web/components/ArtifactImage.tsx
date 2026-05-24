import type { ComponentType } from "react";
import { ARTIFACT_SVG, type ArtifactKey } from "@werewolf/ui/artifacts";

interface ArtifactImageProps {
  artifact: ArtifactKey;
  size?: number;
}

/**
 * PR 3 version: SVG-only wrapper.
 *
 * Renders the geometric SVG artifact from @werewolf/ui. PR 6 can explicitly
 * switch this wrapper to next/image for painterly webp variants.
 */
export function ArtifactImage({ artifact, size = 144 }: ArtifactImageProps) {
  const SVGComponent: ComponentType<{ size?: number }> = ARTIFACT_SVG[artifact];

  return <SVGComponent size={size} />;
}
