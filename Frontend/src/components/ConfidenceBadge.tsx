import { AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";

export default function ConfidenceBadge({ level }) {
  const config = {
    High: { icon: CheckCircle, className: "text-accent bg-accent/10", label: "High Confidence" },
    Medium: { icon: HelpCircle, className: "text-primary bg-primary/10", label: "Medium Confidence" },
    Low: { icon: AlertTriangle, className: "text-warning bg-warning/10", label: "Low Confidence" },
  };

  const c = config[level] || config.Medium;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.className}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}