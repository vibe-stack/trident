import { fal } from "@fal-ai/client";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import type { TextureKind } from "@ggez/shared";
import {
  createAiTextureDraft,
  createColorPrompt,
  createDerivativePrompt,
  createSourceColorPrompt,
  createTextureName,
  isTextureGenerationRequest,
  mapFalResolution,
  type TextureGenerationRequest,
  type TextureGenerationResponse
} from "../src/lib/texture-generation-contract";

const API_PATH = "/api/ai/textures";

export function createTextureGenerationApiPlugin(): Plugin {
  return {
    configurePreviewServer(server) {
      registerTextureApi(server);
    },
    configureServer(server) {
      registerTextureApi(server);
    },
    name: "texture-generation-api"
  };
}

function registerTextureApi(server: Pick<ViteDevServer, "middlewares"> | Pick<PreviewServer, "middlewares">) {
  server.middlewares.use(async (req, res, next) => {
    const pathname = req.url?.split("?")[0];

    if (pathname !== API_PATH) {
      next();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    try {
      const rawBody = await readBody(req);
      const parsed = JSON.parse(rawBody) as unknown;

      if (!isTextureGenerationRequest(parsed)) {
        sendJson(res, 400, { error: "Invalid texture generation request." });
        return;
      }

      const payload = await generateTextures(parsed);
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : "Texture generation failed."
      });
    }
  });
}

async function generateTextures(
  request: TextureGenerationRequest
): Promise<TextureGenerationResponse> {
  const apiKey = process.env.FAL_KEY;

  if (!apiKey) {
    throw new Error("Missing FAL_KEY in the server environment.");
  }

  fal.config({
    credentials: apiKey
  });

  if (request.sourceTextureDataUrl) {
    return {
      textures: await Promise.all(
        (
          ["color", "normal", "metalness", "roughness"] as const
        )
          .filter((kind) => request.maps[kind])
          .map((kind) =>
            generateTextureFromSource(
              kind,
              request.sourceTextureDataUrl!,
              request
            )
          )
      )
    };
  }

  const derivativeKinds = (
    ["normal", "metalness", "roughness"] as const
  ).filter((kind) => request.maps[kind]);

  const shouldGenerateColorTexture = request.maps.color || derivativeKinds.length > 0;

  if (!shouldGenerateColorTexture) {
    return {
      textures: []
    };
  }

  const colorTexture = await generateColorTexture(request);

  const derivatives = await Promise.all(
    derivativeKinds.map((kind) =>
      generateDerivedTexture(kind, colorTexture.dataUrl, request)
    )
  );

  return {
    textures: request.maps.color
      ? [colorTexture, ...derivatives]
      : derivatives
  };
}

async function generateColorTexture(request: TextureGenerationRequest) {
  const result = await fal.subscribe("fal-ai/nano-banana-2", {
    input: {
      aspect_ratio: "1:1",
      limit_generations: true,
      num_images: 1,
      output_format: "png",
      prompt: createColorPrompt(request.prompt),
      resolution: mapFalResolution(request.size),
      sync_mode: true
    },
    logs: false
  });

  return buildTextureDraft("color", result, request);
}

async function generateDerivedTexture(
  kind: Exclude<TextureKind, "color">,
  colorTextureDataUrl: string,
  request: TextureGenerationRequest
) {
  const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
    input: {
      aspect_ratio: "1:1",
      image_urls: [colorTextureDataUrl],
      limit_generations: true,
      num_images: 1,
      output_format: "png",
      prompt: createDerivativePrompt(kind, request.prompt),
      resolution: mapFalResolution(request.size),
      sync_mode: true
    },
    logs: false
  });

  return buildTextureDraft(kind, result, request);
}

async function generateTextureFromSource(
  kind: TextureKind,
  sourceTextureDataUrl: string,
  request: TextureGenerationRequest
) {
  const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
    input: {
      aspect_ratio: "1:1",
      image_urls: [sourceTextureDataUrl],
      limit_generations: true,
      num_images: 1,
      output_format: "png",
      prompt:
        kind === "color"
          ? createSourceColorPrompt(request.prompt)
          : createDerivativePrompt(kind, request.prompt),
      resolution: mapFalResolution(request.size),
      sync_mode: true
    },
    logs: false
  });

  return buildTextureDraft(kind, result, request);
}

async function buildTextureDraft(
  kind: TextureKind,
  result: unknown,
  request: TextureGenerationRequest
) {
  const image = extractFirstImage(result);

  if (!image?.url) {
    throw new Error("Fal did not return an image.");
  }

  const mimeType = image.content_type ?? "image/png";

  return createAiTextureDraft({
    dataUrl: await fetchAsDataUrl(image.url, mimeType),
    kind,
    mimeType,
    model: request.model,
    name: createTextureName(kind, request.prompt),
    prompt: request.prompt,
    size: request.size
  });
}

function extractFirstImage(result: unknown) {
  if (
    typeof result === "object" &&
    result &&
    "data" in result &&
    typeof result.data === "object" &&
    result.data &&
    "images" in result.data &&
    Array.isArray(result.data.images)
  ) {
    const [image] = result.data.images as Array<{
      content_type?: string;
      url?: string;
    }>;

    return image;
  }

  return undefined;
}

async function fetchAsDataUrl(url: string, mimeType: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download generated texture: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return `data:${mimeType};base64,${base64}`;
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>
) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
