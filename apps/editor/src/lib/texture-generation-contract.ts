import type { TextureKind, TextureSource, TextureRecord } from "@ggez/shared";

export type TextureGenerationModelId = "nano-banana-2";

export type TextureGenerationRequest = {
  maps: {
    color: boolean;
    metalness: boolean;
    normal: boolean;
    roughness: boolean;
  };
  model: TextureGenerationModelId;
  prompt: string;
  size: 256 | 512 | 1024 | 2048 | 4096;
  sourceTextureDataUrl?: string;
};

export type GeneratedTextureDraft = Omit<TextureRecord, "createdAt" | "id">;

export type TextureGenerationResponse = {
  textures: GeneratedTextureDraft[];
};

export const TEXTURE_GENERATION_MODELS: Array<{
  id: TextureGenerationModelId;
  label: string;
}> = [{ id: "nano-banana-2", label: "Nano Banana 2" }];

export function createTextureName(kind: TextureKind, prompt: string) {
  const label = prompt.trim().replace(/\s+/g, " ").slice(0, 42) || "Texture";
  return `${label} ${formatTextureKind(kind)}`;
}

export function mapFalResolution(size: TextureGenerationRequest["size"]) {
  if (size <= 512) {
    return "0.5K";
  }

  if (size === 1024) {
    return "1K";
  }

  if (size === 2048) {
    return "2K";
  }

  return "4K";
}

export function createColorPrompt(prompt: string) {
  return [
    prompt.trim(),
    "Create a seamless tileable PBR base color texture only.",
    "Flat orthographic material scan.",
    "No lighting, no shadows, no perspective, no text, no watermark."
  ].join(" ");
}

export function createDerivativePrompt(
  kind: Exclude<TextureKind, "color">,
  prompt: string
) {
  const shared = [
    `Use the input image as the source ${prompt.trim()} material.`,
    "Keep it seamless and tileable.",
    "Preserve the same surface details and layout."
  ];

  if (kind === "normal") {
    return [
      ...shared,
      "Output a tangent-space normal map only.",
      "Blue-purple normal map colors, no shading, no text."
    ].join(" ");
  }

  if (kind === "metalness") {
    return [
      ...shared,
      "Output a metalness map only.",
      "Strict grayscale, white is metal, black is dielectric, no text."
    ].join(" ");
  }

  return [
    ...shared,
    "Output a roughness map only.",
    "Strict grayscale, white is rough, black is smooth, no text."
  ].join(" ");
}

export function isTextureGenerationRequest(
  value: unknown
): value is TextureGenerationRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const request = value as Partial<TextureGenerationRequest>;

  return (
    typeof request.prompt === "string" &&
    typeof request.model === "string" &&
    typeof request.size === "number" &&
    (request.sourceTextureDataUrl === undefined ||
      typeof request.sourceTextureDataUrl === "string") &&
    typeof request.maps === "object" &&
    request.maps !== null &&
    typeof request.maps.color === "boolean" &&
    typeof request.maps.normal === "boolean" &&
    typeof request.maps.metalness === "boolean" &&
    typeof request.maps.roughness === "boolean"
  );
}

export function createAiTextureDraft(
  input: Omit<GeneratedTextureDraft, "source">
): GeneratedTextureDraft {
  return {
    ...input,
    source: "ai" satisfies TextureSource
  };
}

export function createSourceColorPrompt(prompt: string) {
  return [
    `Use the input image as the source ${prompt.trim()} material.`,
    "Output a seamless tileable PBR base color texture only.",
    "Flat orthographic material scan, no lighting, no shadows, no text."
  ].join(" ");
}

function formatTextureKind(kind: TextureKind) {
  switch (kind) {
    case "color":
      return "Color";
    case "metalness":
      return "Metalness";
    case "normal":
      return "Normal";
    case "roughness":
      return "Roughness";
  }
}
