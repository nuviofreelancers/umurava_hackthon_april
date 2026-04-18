import { useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, MessageSquare, Briefcase, FileText, ArrowRightCircle, Loader2 } from "lucide-react";
import { results as resultsApi } from "@/api/backend";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

export default function ReasoningPanel({ result }) {
  const { toast } = useToast();
  const [addingTo, setAddingTo] = useState(null);
  const [addedTo, setAddedTo] = useState([]);

  const addToShortlist = async (targetRole) => {
    setAddingTo(targetRole.job_id);
    try {
      await resultsApi.create({
        job_id: targetRole.job_id,
        applicant_id: result.applicant_id,
        applicant_name: result.applicant_name,
        match_score: targetRole.estimated_score,
        rank: 999,
        skills_score: result.skills_score,
        experience_score: result.experience_score,
        education_score: result.education_score,
        relevance_score: result.relevance_score,
        strengths: result.strengths,
        gaps: result.gaps,
        recommendation: result.recommendation,
        confidence_level: result.confidence_level,
        bias_flags: result.bias_flags,
        candidate_feedback: result.candidate_feedback,
      });
      setAddedTo(prev => [...prev, targetRole.job_id]);
      toast({ title: "Added to shortlist", description: `${result.applicant_name} added to ${targetRole.job_title} shortlist.` });
    } catch {
      toast({ title: "Failed to add to shortlist", variant: "destructive" });
    }
    setAddingTo(null);
  };

  return (
    <div className="border-t border-border px-5 py-5 bg-muted/20 space-y-5 animate-fade-in">
      <div>
        <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-3">Score Breakdown</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ScoreBar label="Skills Match" score={result.skills_score} weight={result.screening_weights_used?.skills} />
          <ScoreBar label="Experience" score={result.experience_score} weight={result.screening_weights_used?.experience} />
          <ScoreBar label="Education" score={result.education_score} weight={result.screening_weights_used?.education} />
          <ScoreBar label="Relevance" score={result.relevance_score} weight={result.screening_weights_used?.relevance} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-accent" /> Strengths
          </h4>
          <ul className="space-y-1.5">
            {(result.strengths || []).map((s, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-accent mt-1.5 shrink-0" />{s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-destructive" /> Gaps & Risks
          </h4>
          <ul className="space-y-1.5">
            {(result.gaps || []).map((g, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-destructive mt-1.5 shrink-0" />{g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {result.recommendation && (
        <div className="bg-card rounded-lg border border-border p-4">
          <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-primary" /> AI Recommendation
          </h4>
          <p className="text-sm text-foreground leading-relaxed">{result.recommendation}</p>
        </div>
      )}

      {(result.bias_flags || []).length > 0 && (
        <div className="bg-warning/5 rounded-lg border border-warning/20 p-4">
          <h4 className="font-heading font-semibold text-xs text-warning uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Bias / Confidence Alerts
          </h4>
          <ul className="space-y-1">
            {result.bias_flags.map((f, i) => <li key={i} className="text-xs text-foreground">{f}</li>)}
          </ul>
        </div>
      )}

      {(result.other_matching_roles || []).length > 0 && (
        <div>
          <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-primary" /> Other Matching Roles
          </h4>
          <div className="flex flex-col gap-2">
            {result.other_matching_roles.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-card border border-border rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{r.job_title}</span>
                  <span className="text-muted-foreground">~{r.estimated_score}%</span>
                </div>
                <Button
                  size="sm"
                  variant={addedTo.includes(r.job_id) ? "secondary" : "outline"}
                  className="h-7 text-xs gap-1.5"
                  disabled={addedTo.includes(r.job_id) || addingTo === r.job_id}
                  onClick={() => addToShortlist(r)}
                >
                  {addingTo === r.job_id ? <><Loader2 className="w-3 h-3 animate-spin" /> Adding...</>
                    : addedTo.includes(r.job_id) ? "Added"
                    : <><ArrowRightCircle className="w-3 h-3" /> Add to Shortlist</>}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.candidate_feedback && (
        <div>
          <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" /> Candidate Feedback (Draft)
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed italic">{result.candidate_feedback}</p>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score, weight }) {
  return (
    <div className="bg-card rounded-lg border border-border p-3 text-center">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold font-heading">{score || 0}</p>
      {weight && <p className="text-[10px] text-muted-foreground">Weight: {weight}%</p>}
    </div>
  );
}
