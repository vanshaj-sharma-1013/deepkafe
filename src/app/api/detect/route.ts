import { NextRequest, NextResponse } from "next/server";
import type { AnalysisMode, DetectionResult, ImageMetadata, ModelInsight } from "@/lib/types";
import { callGemini, callGroq, callOpenRouter, type ProviderVerdict } from "@/lib/providers";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const BACKEND_TIMEOUT_MS = 20_000;

interface ProviderDef {
  id: string;
  label: string;
  provider: string;
  envKey: string;
  call: (base64: string, mimeType: string, apiKey: string) => Promise<ProviderVerdict>;
}

const PROVIDER_REGISTRY: ProviderDef[] = [
  { id: "groq", label: "Vision Consensus", provider: "Groq", envKey: "GROQ_API_KEY", call: callGroq },
  { id: "gemini", label: "Frequency & Artifact Analysis", provider: "Gemini", envKey: "GEMINI_API_KEY", call: callGemini },
  { id: "openrouter", label: "GAN Fingerprint Detector", provider: "OpenRouter", envKey: "OPENROUTER_API_KEY", call: callOpenRouter },
];

function seededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

async function readPngDimensions(buffer: Buffer): Promise<{ width: number; height: number } | null> {
  if (buffer.length < 24) return null;
  const isPng = buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (isPng) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return null;
}

async function readJpegDimensions(buffer: Buffer): Promise<{ width: number; height: number } | null> {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }
  return null;
}

async function extractDimensions(buffer: Buffer, mimeType: string): Promise<{ width: number; height: number }> {
  const fromPng = mimeType === "image/png" ? await readPngDimensions(buffer) : null;
  const fromJpeg = mimeType !== "image/png" ? await readJpegDimensions(buffer) : null;
  const dims = fromPng ?? fromJpeg;
  return dims ?? { width: 0, height: 0 };
}

function buildSimulatedResult(
  file: File,
  buffer: Buffer,
  dimensions: { width: number; height: number },
  mode: AnalysisMode
): DetectionResult {
  const rand = seededRandom(hashString(file.name + file.size + buffer.length));
  const skewToFake = rand() > 0.45;
  const baseFake = skewToFake ? 55 + rand() * 40 : 5 + rand() * 35;
  const fakeScore = Math.min(99.9, Math.max(0.1, baseFake + (rand() - 0.5) * 6));
  const realScore = 100 - fakeScore;
  const verdict: "fake" | "real" = fakeScore >= 50 ? "fake" : "real";
  const confidence = verdict === "fake" ? fakeScore : realScore;

  const modelDefs: Array<{ name: string; provider: string }> = [
    { name: "Vision Consensus", provider: "Groq" },
    { name: "Frequency Artifact Analysis", provider: "Gemini" },
    { name: "GAN Fingerprint Detector", provider: "OpenRouter" },
  ];
  if (mode === "deep") {
    modelDefs.push({ name: "Facial Landmark Consistency", provider: "Gemini" });
    modelDefs.push({ name: "Compression Noise Residual", provider: "OpenRouter" });
  }

  const models: ModelInsight[] = modelDefs.map((def, index) => {
    const jitter = (rand() - 0.5) * 18;
    const modelFake = Math.min(99.5, Math.max(0.5, fakeScore + jitter));
    const modelVerdict: ModelInsight["verdict"] =
      modelFake >= 55 ? "fake" : modelFake <= 45 ? "real" : "uncertain";
    return {
      name: def.name,
      provider: def.provider,
      verdict: modelVerdict,
      confidence: Number((modelVerdict === "fake" ? modelFake : 100 - modelFake).toFixed(2)),
      notes:
        modelVerdict === "fake"
          ? "Detected irregular pixel-level artifacts consistent with synthetic generation."
          : modelVerdict === "real"
          ? "No significant manipulation artifacts detected in analyzed regions."
          : "Mixed signals; recommend manual review.",
      latencyMs: 220 + Math.round(rand() * 900) + index * 40,
    };
  });

  const metadata: ImageMetadata = {
    fileName: file.name,
    fileSizeBytes: file.size,
    format: file.type || "unknown",
    width: dimensions.width,
    height: dimensions.height,
  };

  return {
    verdict,
    confidence: Number(confidence.toFixed(2)),
    fakeScore: Number(fakeScore.toFixed(2)),
    realScore: Number(realScore.toFixed(2)),
    mode,
    models,
    metadata,
    processedAt: new Date().toISOString(),
    totalLatencyMs: models.reduce((sum, m) => sum + m.latencyMs, 0),
    source: "simulated",
  };
}

async function proxyToPythonBackend(
  backendUrl: string,
  file: File,
  mode: AnalysisMode
): Promise<DetectionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const forwardForm = new FormData();
    forwardForm.append("file", file, file.name);
    forwardForm.append("mode", mode);

    const response = await fetch(backendUrl, {
      method: "POST",
      body: forwardForm,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }

    const data = (await response.json()) as DetectionResult;
    return { ...data, source: data.source ?? "backend" };
  } finally {
    clearTimeout(timeout);
  }
}

async function runLiveDetection(
  file: File,
  buffer: Buffer,
  dimensions: { width: number; height: number },
  mode: AnalysisMode
): Promise<DetectionResult | null> {
  const available = PROVIDER_REGISTRY.filter((p) => !!process.env[p.envKey]);
  if (available.length === 0) return null;

  const base64 = buffer.toString("base64");
  let attempted: ProviderDef[];
  let settled: PromiseSettledResult<ProviderVerdict>[];

  if (mode === "deep") {
    attempted = available;
    settled = await Promise.allSettled(
      attempted.map((def) => def.call(base64, file.type, process.env[def.envKey] as string))
    );
  } else {
    attempted = [];
    settled = [];
    for (const def of available) {
      attempted.push(def);
      const outcome = await def
        .call(base64, file.type, process.env[def.envKey] as string)
        .then((v): PromiseSettledResult<ProviderVerdict> => ({ status: "fulfilled", value: v }))
        .catch((reason): PromiseSettledResult<ProviderVerdict> => ({ status: "rejected", reason }));
      settled.push(outcome);
      if (outcome.status === "fulfilled") break;
    }
  }

  const models: ModelInsight[] = settled.map((outcome, index) => {
    const def = attempted[index];
    if (outcome.status === "fulfilled") {
      const v = outcome.value;
      const confidenceInVerdict = v.verdict === "fake" ? v.fakeConfidence : 100 - v.fakeConfidence;
      return {
        name: def.label,
        provider: def.provider,
        verdict: v.verdict,
        confidence: Number(confidenceInVerdict.toFixed(2)),
        notes: v.notes,
        latencyMs: v.latencyMs,
      };
    }
    console.error(`[detect] provider ${def.id} failed:`, outcome.reason);
    return {
      name: def.label,
      provider: def.provider,
      verdict: "uncertain",
      confidence: 0,
      notes: `Provider call failed: ${
        outcome.reason instanceof Error ? outcome.reason.message : "unknown error"
      }`,
      latencyMs: 0,
    };
  });

  const succeeded = settled.filter(
    (o): o is PromiseFulfilledResult<ProviderVerdict> => o.status === "fulfilled"
  );

  if (succeeded.length === 0) return null;

  const fakeScore =
    succeeded.reduce((sum, o) => sum + o.value.fakeConfidence, 0) / succeeded.length;
  const realScore = 100 - fakeScore;
  const verdict: "fake" | "real" = fakeScore >= 50 ? "fake" : "real";
  const confidence = verdict === "fake" ? fakeScore : realScore;

  const metadata: ImageMetadata = {
    fileName: file.name,
    fileSizeBytes: file.size,
    format: file.type || "unknown",
    width: dimensions.width,
    height: dimensions.height,
  };

  return {
    verdict,
    confidence: Number(confidence.toFixed(2)),
    fakeScore: Number(fakeScore.toFixed(2)),
    realScore: Number(realScore.toFixed(2)),
    mode,
    models,
    metadata,
    processedAt: new Date().toISOString(),
    totalLatencyMs: models.reduce((sum, m) => sum + m.latencyMs, 0),
    source: "live",
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const modeRaw = formData.get("mode");
    const mode: AnalysisMode = modeRaw === "deep" ? "deep" : "quick";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image file was provided." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PNG, JPG, or JPEG image." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 15MB." },
        { status: 400 }
      );
    }

    const backendUrl = process.env.PYTHON_BACKEND_URL;

    if (backendUrl) {
      try {
        const result = await proxyToPythonBackend(backendUrl, file, mode);
        return NextResponse.json(result);
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        return NextResponse.json(
          {
            error: isAbort
              ? "The detection backend timed out. Please try again."
              : "Failed to reach the detection backend.",
          },
          { status: 502 }
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const dimensions = await extractDimensions(buffer, file.type);

    const liveResult = await runLiveDetection(file, buffer, dimensions, mode);
    if (liveResult) {
      return NextResponse.json(liveResult);
    }

    if (PROVIDER_REGISTRY.some((p) => !!process.env[p.envKey])) {
      return NextResponse.json(
        { error: "All configured detection providers failed to respond. Please try again." },
        { status: 502 }
      );
    }

    const result = buildSimulatedResult(file, buffer, dimensions, mode);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred while processing the image." },
      { status: 500 }
    );
  }
}
