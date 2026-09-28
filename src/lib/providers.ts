const FORENSIC_PROMPT = `You are an expert deepfake and image forensics analyst. Examine this image carefully for signs of AI generation, GAN/diffusion artifacts, face-swap inconsistencies, unnatural lighting, texture blending, or digital tampering.

Respond with ONLY a compact JSON object, no other text, no markdown fences:
{"verdict": "fake" or "real", "confidence": <integer 0-100, how confident you are in that verdict>, "notes": "<one short sentence citing the key visual evidence>"}`;

export interface ProviderVerdict {
  verdict: "fake" | "real";
  fakeConfidence: number;
  notes: string;
  latencyMs: number;
}

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

export async function callGroq(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<ProviderVerdict> {
  const started = Date.now();
  return withTimeout(async (signal) => {
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
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: FORENSIC_PROMPT },
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
    const text = data?.choices?.[0]?.message?.content ?? "";
    return toProviderVerdict(extractJson(text), Date.now() - started);
  }, 25_000);
}

export async function callGemini(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<ProviderVerdict> {
  const started = Date.now();
  return withTimeout(async (signal) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: FORENSIC_PROMPT },
                { inlineData: { mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return toProviderVerdict(extractJson(text), Date.now() - started);
  }, 25_000);
}

export async function callOpenRouter(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<ProviderVerdict> {
  const started = Date.now();
  return withTimeout(async (signal) => {
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
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: FORENSIC_PROMPT },
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
    const text = data?.choices?.[0]?.message?.content ?? "";
    return toProviderVerdict(extractJson(text), Date.now() - started);
  }, 35_000);
}
