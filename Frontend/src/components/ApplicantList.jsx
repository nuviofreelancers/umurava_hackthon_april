import { applicants as applicantsApi, results as resultsApi } from "@/api/backend";
import { Trash2, User, MapPin, Briefcase, GraduationCap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import EmptyState from "./EmptyState";

export default function ApplicantList({ applicants, onRefresh }) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const deleteApplicant = async (id, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await resultsApi.deleteByApplicant(id);
      await applicantsApi.delete(id);
      toast({ title: "Candidate removed" });
      onRefresh?.();
    } catch {
      toast({ title: "Failed to remove candidate", variant: "destructive" });
    }
  };

  if (applicants.length === 0) {
    return <EmptyState icon={User} title="No candidates yet" description="Upload resumes or add candidates manually to get started" />;
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="font-heading font-semibold text-sm">{applicants.length} Candidates</h3>
      </div>
      <div className="divide-y divide-border">
        {applicants.map(a => (
          <div key={a.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-muted/30 transition-colors group">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="font-medium text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate(`/candidates/${a.id}`)}
              >
                {a.full_name}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                {a.current_role && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{a.current_role}</span>}
                {a.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</span>}
                {a.education_level && <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{a.education_level}</span>}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{a.source}</span>
              </div>
              {(a.skills || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {a.skills.slice(0, 5).map(s => (
                    <span key={s} className="px-1.5 py-0.5 bg-primary/5 text-primary rounded text-[10px]">{s}</span>
                  ))}
                  {a.skills.length > 5 && <span className="text-[10px] text-muted-foreground">+{a.skills.length - 5}</span>}
                </div>
              )}
            </div>
            <button
              onClick={() => deleteApplicant(a.id, a.full_name)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
