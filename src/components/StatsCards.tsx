import { BarChart3, CheckCircle2, ImageIcon, ShieldAlert } from "lucide-react";

interface StatItem {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}

export interface DashboardStats {
  totalTested: number;
  accuracyPercent: number;
  realCount: number;
  fakeCount: number;
}

export default function StatsCards({ stats }: { stats: DashboardStats }) {
  const total = stats.realCount + stats.fakeCount;
  const realRatio = total > 0 ? Math.round((stats.realCount / total) * 100) : 0;
  const fakeRatio = 100 - realRatio;

  const items: StatItem[] = [
    {
      label: "Total Tested",
      value: stats.totalTested.toLocaleString(),
      icon: <ImageIcon size={20} />,
      accent: "text-[#3b6ea5] bg-[#dbe8f5]",
    },
    {
      label: "Model Accuracy",
      value: `${stats.accuracyPercent}%`,
      icon: <CheckCircle2 size={20} />,
      accent: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "Real vs Fake Ratio",
      value: `${realRatio}% / ${fakeRatio}%`,
      icon: <BarChart3 size={20} />,
      accent: "text-violet-600 bg-violet-100",
    },
    {
      label: "Flagged as Fake",
      value: stats.fakeCount.toLocaleString(),
      icon: <ShieldAlert size={20} />,
      accent: "text-red-600 bg-red-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-4 rounded-2xl border border-[#c9dbee] bg-white p-5 shadow-sm"
        >
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.accent}`}>
            {item.icon}
          </div>
          <div>
            <p className="text-xs text-[#5c7a9c]">{item.label}</p>
            <p className="text-xl font-semibold text-[#1b2733]">
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
