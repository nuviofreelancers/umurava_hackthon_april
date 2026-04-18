export default function ScoreBadge({ score, size = "md" }) {
  const getColor = (s) => {
    if (s >= 80) return "text-accent bg-accent/10 border-accent/20";
    if (s >= 60) return "text-primary bg-primary/10 border-primary/20";
    if (s >= 40) return "text-warning bg-warning/10 border-warning/20";
    return "text-destructive bg-destructive/10 border-destructive/20";
  };

  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-sm font-semibold",
    lg: "w-16 h-16 text-lg font-bold",
  };

  return (
    <div className={`${sizes[size]} ${getColor(score)} rounded-full border flex items-center justify-center`}>
      {score}
    </div>
  );
}