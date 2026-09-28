"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  FileImage,
  Gauge,
  Search,
} from "lucide-react";
import type { DetectionResult } from "@/lib/types";
import { cn, formatBytes, formatPercent } from "@/lib/utils";

interface ResultsCardProps {
  result: DetectionResult;
}

function ModelRow({ model }: { model: DetectionResult["models"][number] }) {
  const verdictStyles: Record<string, string> = {
    fake: "bg-red-100 text-red-700",
    real: "bg-emerald-100 text-emerald-700",
    uncertain: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#c9dbee] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-[#1b2733]">{model.name}</p>
        <p className="text-xs text-[#5c7a9c]">
          via {model.provider}
          {model.latencyMs > 0 ? ` · ${model.latencyMs}ms` : ""}
        </p>
        <p className="mt-1 text-sm text-[#3d5670]">{model.notes}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", verdictStyles[model.verdict])}>
          {model.verdict}
        </span>
        <span className="text-sm font-semibold tabular-nums text-[#1b2733]">
          {formatPercent(model.confidence)}
        </span>
      </div>
    </div>
  );
}

export default function ResultsCard({ result }: ResultsCardProps) {
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isFake = result.verdict === "fake";

  const sourceLabel =
    result.source === "live"
      ? "Live multi-model analysis"
      : result.source === "backend"
      ? "Python backend analysis"
      : "Simulated demo result — no detection provider is configured";

  return (
    <div className="mt-8 w-full max-w-md">
      <div className="mb-4 h-px w-full bg-[#a9c6e3]" />

      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-md px-5 py-4 text-center font-medium",
          isFake ? "bg-[#f5d97a] text-[#5a4200]" : "bg-[#bfe6c8] text-[#0f4a24]"
        )}
      >
        {isFake ? <AlertTriangle size={20} /> : <BadgeCheck size={20} />}
        {isFake ? "Potentially Manipulated / Fake" : "Likely Authentic"}
      </div>

      <div className="mt-4 space-y-1 text-center text-[#1b2733]">
        <p>Confidence: {formatPercent(result.confidence)}</p>
        <p>fake: {formatPercent(result.fakeScore)}</p>
        <p>real: {formatPercent(result.realScore)}</p>
      </div>

      <p
        className={cn(
          "mt-3 text-center text-xs",
          result.source === "simulated" ? "text-amber-700" : "text-[#5c7a9c]"
        )}
      >
        {sourceLabel}
      </p>

      <button
        onClick={() => setHeatmapOpen((v) => !v)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[#3b6ea5] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2f5c8a]"
      >
        <Search size={16} />
        Tampering Heatmap ]
        {heatmapOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {heatmapOpen && (
        <div className="mt-2 flex h-32 items-center justify-center rounded-md border-2 border-dashed border-[#a9c6e3] bg-[#dbe8f5] text-sm text-[#5c7a9c]">
          Heatmap visualization requires a live backend connection.
        </div>
      )}

      <button
        onClick={() => setDetailsOpen((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-[#a9c6e3] bg-white px-4 py-3 text-sm font-medium text-[#3b6ea5] transition-colors hover:bg-[#eef3f9]"
      >
        Model Consensus & Metadata
        {detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {detailsOpen && (
        <div className="mt-3 space-y-4">
          <div className="space-y-2">
            {result.models.map((model) => (
              <ModelRow key={model.name} model={model} />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-md border border-[#c9dbee] bg-white p-3">
              <FileImage size={16} className="text-[#5c7a9c]" />
              <div>
                <p className="text-xs text-[#5c7a9c]">Dimensions</p>
                <p className="text-sm font-medium text-[#1b2733]">
                  {result.metadata.width || "?"} × {result.metadata.height || "?"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-[#c9dbee] bg-white p-3">
              <Gauge size={16} className="text-[#5c7a9c]" />
              <div>
                <p className="text-xs text-[#5c7a9c]">File Size</p>
                <p className="text-sm font-medium text-[#1b2733]">
                  {formatBytes(result.metadata.fileSizeBytes)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-[#c9dbee] bg-white p-3">
              <FileImage size={16} className="text-[#5c7a9c]" />
              <div>
                <p className="text-xs text-[#5c7a9c]">Format</p>
                <p className="text-sm font-medium text-[#1b2733]">{result.metadata.format}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-[#c9dbee] bg-white p-3">
              <Clock size={16} className="text-[#5c7a9c]" />
              <div>
                <p className="text-xs text-[#5c7a9c]">Total Latency</p>
                <p className="text-sm font-medium text-[#1b2733]">{result.totalLatencyMs}ms</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
