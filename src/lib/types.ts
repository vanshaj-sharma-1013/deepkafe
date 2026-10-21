export type AnalysisMode = "quick" | "deep";

export interface SuspectRegion {
  /** Fraction of image width from the left edge, 0-1. */
  x: number;
  /** Fraction of image height from the top edge, 0-1. */
  y: number;
  label: string;
}

export interface ModelInsight {
  name: string;
  provider: string;
  verdict: "fake" | "real" | "uncertain";
  confidence: number;
  notes: string;
  latencyMs: number;
  regions?: SuspectRegion[];
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
  regions?: SuspectRegion[];
}

export interface DetectionError {
  error: string;
}
