import Link from "next/link";
import { ArrowRight, Layers, ScanSearch, ShieldCheck } from "lucide-react";
import StatsCards, { DashboardStats } from "@/components/StatsCards";

const mockStats: DashboardStats = {
  totalTested: 1284,
  accuracyPercent: 96,
  realCount: 742,
  fakeCount: 542,
};

const features = [
  {
    icon: <ScanSearch size={20} />,
    title: "Multi-Model Chain",
    description:
      "Every upload is cross-checked across Groq, Gemini, and OpenRouter models for consensus scoring.",
  },
  {
    icon: <Layers size={20} />,
    title: "Metadata Forensics",
    description:
      "Inspect dimensions, file size, and format alongside compression and pixel-level artifact analysis.",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "Confidence Scoring",
    description:
      "Get calibrated authenticity confidence with a transparent breakdown of each model's verdict.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
      <section className="flex flex-col items-start gap-6 text-left">
        <span className="rounded-full bg-[#dbe8f5] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#2f5c8a]">
          Deepfake Detection Testing Module
        </span>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[#1b2733] sm:text-5xl">
          Test, validate, and inspect AI image detection results in one workbench.
        </h1>
        <p className="max-w-xl text-lg text-[#3d5670]">
          Upload images, run them through a chained multi-model detection pipeline, and
          review confidence scores, model consensus, and metadata — all in a single
          dashboard built for testing and validation.
        </p>
        <Link
          href="/test"
          className="inline-flex items-center gap-2 rounded-full bg-[#3b6ea5] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2f5c8a]"
        >
          Open Testing Workbench
          <ArrowRight size={16} />
        </Link>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-lg font-semibold text-[#1b2733]">
          Overview
        </h2>
        <StatsCards stats={mockStats} />
      </section>

      <section className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-[#c9dbee] bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#dbe8f5] text-[#3b6ea5]">
              {feature.icon}
            </div>
            <h3 className="font-semibold text-[#1b2733]">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm text-[#3d5670]">
              {feature.description}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
