import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

const steps = [
  { min: 0, label: "Preparing candidate data..." },
  { min: 20, label: "Sending to AI for evaluation..." },
  { min: 40, label: "Analyzing skills and experience..." },
  { min: 60, label: "Scoring and ranking candidates..." },
  { min: 80, label: "Saving results..." },
  { min: 95, label: "Complete!" },
];

export default function ScreeningProgress({ progress }) {
  const currentStep = [...steps].reverse().find(s => progress >= s.min);

  return (
    <div className="bg-card rounded-xl border border-primary/20 p-5 animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
        </div>
        <div>
          <p className="font-heading font-semibold text-sm">AI Screening in Progress</p>
          <p className="text-xs text-muted-foreground">{currentStep?.label}</p>
        </div>
        <span className="ml-auto text-sm font-mono text-primary">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}