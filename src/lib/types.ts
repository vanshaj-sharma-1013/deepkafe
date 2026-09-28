export type AnalysisMode = "quick" | "deep";

export interface ModelInsight {
  name: string;
  provider: string;
  verdict: "fake" | "real" | "uncertain";
  confidence: number;
  notes: string;
  latencyMs: number;
}

export interface ImageMetadata {
  fileName: string;
  fileSizeBytes: number;
  format: string;
  width: number;
  height: number;
}

export type ResultSource = "live" | "backend" | "simulated";

export interface DetectionResult {
  verdict: "fake" | "real";
  confidence: number;
  fakeScore: number;
  realScore: number;
  mode: AnalysisMode;
  models: ModelInsight[];
  metadata: ImageMetadata;
  processedAt: string;
  totalLatencyMs: number;
  source: ResultSource;
}

export interface DetectionError {
  error: string;
}
