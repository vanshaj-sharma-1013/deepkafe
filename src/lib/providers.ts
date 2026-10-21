import type { SuspectRegion } from "./types";

const FORENSIC_PROMPT = `You are an expert deepfake and image forensics analyst. Examine this image carefully for signs of AI generation, GAN/diffusion artifacts, face-swap inconsistencies, unnatural lighting, texture blending, or digital tampering.

Respond with ONLY a compact JSON object, no other text, no markdown fences:
{"verdict": "fake" or "real", "confidence": <integer 0-100, how confident you are in that verdict>, "notes": "<one short sentence citing the key visual evidence>"}`;

// Sent as a separate request, and only after a model has called the image fake,
// so the verdict prompt above (and its accuracy) is unaffected by localization.
// Models are trained to ground objects as bounding boxes in their own native order, so we
// ask for a box (and later use its center) rather than a free-form point, which they place
// far less accurately. Gemini's native order is [ymin, xmin, ymax, xmax]; Qwen-style models
// and most others use [xmin, ymin, xmax, ymax]. Both are normalized to 0-1000.
type BoxOrder = "yxyx" | "xyxy";

function buildLocatePrompt(order: BoxOrder): string {
  const boxFormat =
    order === "yxyx"
      ? "[ymin, xmin, ymax, xmax]"
      : "[xmin, ymin, xmax, ymax]";
  const axisHelp =
    order === "yxyx"
      ? "y values are measured from the TOP edge and x values from the LEFT edge"
      : "x values are measured from the LEFT edge and y values from the TOP edge";

  return `You are an expert image forensics analyst. This image has ALREADY been determined to be AI-generated or digitally tampered, so do not question that. Your only job is to find the specific objects or parts of the image that look artificial, and give a tight bounding box around each one.

Respond with ONLY a compact JSON object, no other text, no markdown fences:
{"regions": [{"label": "<3-6 words naming the object/part and what is wrong with it>", "box_2d": ${boxFormat}}]}

Rules:
- You MUST list between 3 and 6 areas, most suspicious first. Never return an empty list. If nothing is blatant, pick the places where AI generation is most likely to leave traces: skin or surface texture, eyes and teeth, hair and fine edges, hands and fingers, text or logos, reflections and shadows, object boundaries, background details.
- Each box must tightly surround ONE concrete visible object or part that you can actually see in the image (for example the bird, the left hand, the waterfall, the clouds). The label must name that same object, so the box and label always agree.
- Spread the areas across different parts of the image. Do not list the same spot twice.
- Coordinates are integers from 0 to 1000 relative to the FULL image, where 0 is one edge and 1000 is the opposite edge, no matter the image's real pixel size. ${axisHelp}. Do not use pixels or fractions.
- Each label must describe the specific flaw (for example "Warped fingers on left hand"), not a generic category.`;
}

export interface ProviderVerdict {
  verdict: "fake" | "real";
  fakeConfidence: number;
  notes: string;
  latencyMs: number;
}

const MAX_REGIONS = 6;
// Reasoning models can spend much of their budget thinking, so leave plenty of room.
const LOCATE_MAX_TOKENS = 2500;

function extractJson(text: string): { verdict: string; confidence: number; notes: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in model response.");
  const parsed = JSON.parse(match[0]);
  if (
    typeof parsed.verdict !== "string" ||
    typeof parsed.confidence !== "number" ||
    typeof parsed.notes !== "string"
  ) {
    throw new Error("Model response JSON missing required fields.");
  }
  return parsed;
}

interface RawBox {
  /** Box edges exactly as the model wrote them, in the order the prompt asked for. */
  coords: [number, number, number, number];
  label: string;
}

interface ImageDims {
  width: number;
  height: number;
}

// Pulls box objects out of the text even if the surrounding JSON is cut off
// (a common failure when a model runs out of output tokens mid-list).
function salvageBoxes(text: string): RawBox[] {
  const found: RawBox[] = [];
  for (const [chunk] of text.matchAll(/\{[^{}]*\}/g)) {
    try {
      const item = JSON.parse(chunk) as Record<string, unknown>;
      const box = item.box_2d ?? item.bbox_2d ?? item.bbox ?? item.box;
      if (!Array.isArray(box) || box.length !== 4) continue;
      const nums = box.map(Number);
      if (!nums.every(Number.isFinite)) continue;
      found.push({
        coords: nums as [number, number, number, number],
        label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Suspicious area",
      });
    } catch {
      continue;
    }
  }
  return found;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function parseRegions(rawText: string, order: BoxOrder, dims?: ImageDims): SuspectRegion[] {
  // Reasoning models may wrap their thoughts in <think> tags that contain braces.
  const text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const boxes = salvageBoxes(text).slice(0, MAX_REGIONS);
  if (boxes.length === 0) return [];

  // Work out the unit each model actually used, since not all follow "0-1000":
  // fractions (all <= 1), real pixels (anything > 1000), otherwise 0-1000.
  const maxCoord = Math.max(...boxes.flatMap((b) => b.coords));
  const unit: "fraction" | "pixels" | "thousand" =
    maxCoord <= 1 ? "fraction" : maxCoord > 1000 && dims?.width && dims?.height ? "pixels" : "thousand";

  return boxes.map(({ coords, label }) => {
    const [a, b, c, d] = coords;
    // Convert to xmin, ymin, xmax, ymax.
    const [xmin, ymin, xmax, ymax] = order === "yxyx" ? [b, a, d, c] : [a, b, c, d];

    const scaleX = unit === "fraction" ? 1 : unit === "pixels" ? dims!.width : 1000;
    const scaleY = unit === "fraction" ? 1 : unit === "pixels" ? dims!.height : 1000;

    // The center of the box is where the marker goes.
    return {
      x: clamp01((xmin + xmax) / 2 / scaleX),
      y: clamp01((ymin + ymax) / 2 / scaleY),
      label,
    };
  });
}

function toProviderVerdict(
  raw: { verdict: string; confidence: number; notes: string },
  latencyMs: number
): ProviderVerdict {
  const confidenceInVerdict = Math.min(100, Math.max(0, raw.confidence));
  const verdict: "fake" | "real" = raw.verdict.toLowerCase().startsWith("fake") ? "fake" : "real";
  const fakeConfidence = verdict === "fake" ? confidenceInVerdict : 100 - confidenceInVerdict;
  return { verdict, fakeConfidence, notes: raw.notes, latencyMs };
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

type SendPrompt = (
  prompt: string,
  base64: string,
  mimeType: string,
  apiKey: string,
  maxTokens?: number
) => Promise<string>;

const sendGroq: SendPrompt = (prompt, base64, mimeType, apiKey, maxTokens = 600) =>
  withTimeout(async (signal) => {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq request failed with status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }, 25_000);

const sendGemini: SendPrompt = (prompt, base64, mimeType, apiKey, maxTokens = 600) =>
  withTimeout(async (signal) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }, 25_000);

const sendOpenRouter: SendPrompt = (prompt, base64, mimeType, apiKey, maxTokens = 2000) =>
  withTimeout(async (signal) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dots-studio/dots-3-note-preview:free",
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed with status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }, 35_000);

function makeVerdictCall(send: SendPrompt) {
  return async (base64: string, mimeType: string, apiKey: string): Promise<ProviderVerdict> => {
    const started = Date.now();
    const text = await send(FORENSIC_PROMPT, base64, mimeType, apiKey);
    return toProviderVerdict(extractJson(text), Date.now() - started);
  };
}

function makeLocateCall(send: SendPrompt, order: BoxOrder) {
  const prompt = buildLocatePrompt(order);
  return async (
    base64: string,
    mimeType: string,
    apiKey: string,
    dims?: ImageDims
  ): Promise<SuspectRegion[]> => {
    const text = await send(prompt, base64, mimeType, apiKey, LOCATE_MAX_TOKENS);
    return parseRegions(text, order, dims);
  };
}

export const callGroq = makeVerdictCall(sendGroq);
export const callGemini = makeVerdictCall(sendGemini);
export const callOpenRouter = makeVerdictCall(sendOpenRouter);

export const locateGroq = makeLocateCall(sendGroq, "xyxy");
export const locateGemini = makeLocateCall(sendGemini, "yxyx");
export const locateOpenRouter = makeLocateCall(sendOpenRouter, "xyxy");
