import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

const dimensions = [
  { key: "skills", label: "Skills Match", color: "bg-primary" },
  { key: "experience", label: "Relevant Experience", color: "bg-accent" },
  { key: "education", label: "Education", color: "bg-chart-3" },
  { key: "relevance", label: "Role Relevance", color: "bg-chart-4" },
];

export default function WeightSliders({ weights, onChange }) {
  const total = Object.values(weights).reduce((sum, v) => sum + v, 0);

  const handleChange = (key, value) => {
    onChange({ ...weights, [key]: value[0] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-sm">Scoring Weights</h3>
        <span className={`text-xs font-medium ${total === 100 ? 'text-accent' : 'text-destructive'}`}>
          Total: {total}%
        </span>
      </div>

      {/* Weight bar visualization */}
      <div className="h-2 rounded-full overflow-hidden flex">
        {dimensions.map(d => (
          <div
            key={d.key}
            className={`${d.color} transition-all duration-300`}
            style={{ width: `${(weights[d.key] / Math.max(total, 1)) * 100}%` }}
          />
        ))}
      </div>

      {dimensions.map(d => (
        <div key={d.key} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{d.label}</Label>
            <span className="text-xs font-mono text-muted-foreground">{weights[d.key]}%</span>
          </div>
          <Slider
            value={[weights[d.key]]}
            onValueChange={(v) => handleChange(d.key, v)}
            max={100}
            min={0}
            step={5}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
}