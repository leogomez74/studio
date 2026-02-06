import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface QuickStat {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  tooltip?: string;
}

interface QuickStatsProps {
  stats: QuickStat[];
  className?: string;
}

const variantClasses = {
  default: "bg-slate-50 text-slate-900 border-slate-200",
  success: "bg-green-50 text-green-900 border-green-200",
  warning: "bg-yellow-50 text-yellow-900 border-yellow-200",
  danger: "bg-red-50 text-red-900 border-red-200",
  info: "bg-blue-50 text-blue-900 border-blue-200",
};

const iconVariantClasses = {
  default: "text-slate-600",
  success: "text-green-600",
  warning: "text-yellow-600",
  danger: "text-red-600",
  info: "text-blue-600",
};

export function QuickStats({ stats, className }: QuickStatsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-4 gap-3 mb-6",
        className
      )}
    >
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const variant = stat.variant || "default";

        return (
          <Card
            key={index}
            className={cn(
              "border transition-all hover:shadow-md",
              variantClasses[variant]
            )}
            title={stat.tooltip}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium opacity-70 mb-1 truncate">
                    {stat.label}
                  </p>
                  <p className="text-xl font-bold truncate" title={String(stat.value)}>
                    {stat.value}
                  </p>
                </div>
                <Icon className={cn("h-5 w-5 flex-shrink-0", iconVariantClasses[variant])} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}