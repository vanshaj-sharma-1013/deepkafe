"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import UploadZone from "@/components/UploadZone";
import ResultsCard from "@/components/ResultsCard";
import type { AnalysisMode, DetectionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("quick");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = useCallback(
    (selected: File) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setResult(null);
      setError(null);
    },
    [previewUrl]
  );

  const handleClear = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  }, [previewUrl]);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);

      const response = await fetch("/api/detect", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Detection failed. Please try again.");
      }

      setResult(data as DetectionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [file, mode]);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="mb-6 flex items-center gap-2 rounded-full border border-[#a9c6e3] bg-white p-1 text-sm font-medium">
        <button
          onClick={() => setMode("quick")}
          disabled={loading}
          className={cn(
            "rounded-full px-4 py-1.5 transition-colors",
            mode === "quick" ? "bg-[#3b6ea5] text-white" : "text-[#3d5670] hover:text-[#1b2733]"
          )}
        >
          Quick Check
        </button>
        <button
          onClick={() => setMode("deep")}
          disabled={loading}
          className={cn(
            "rounded-full px-4 py-1.5 transition-colors",
            mode === "deep" ? "bg-[#3b6ea5] text-white" : "text-[#3d5670] hover:text-[#1b2733]"
          )}
        >
          Deep Multi-Model Chain
        </button>
      </div>

      <UploadZone
        file={file}
        previewUrl={previewUrl}
        onFileSelect={handleFileSelect}
        onClear={handleClear}
        disabled={loading}
      />

      <button
        onClick={handleAnalyze}
        disabled={!file || loading}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-[#3b6ea5] px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-[#2f5c8a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Search size={16} />
            Analyze Image ]
          </>
        )}
      </button>

      {error && (
        <div className="mt-5 flex w-full max-w-md items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {result && <ResultsCard result={result} previewUrl={previewUrl} />}
    </main>
  );
}
