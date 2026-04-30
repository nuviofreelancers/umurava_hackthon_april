import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Briefcase,
  FileText,
  Send,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// ReasoningPanel
// Expanded detail view for a single screened candidate.
//
// Changes vs original:
//   - "Other Matching Roles" section now opens a RoleReferralModal instead of
//     immediately adding to shortlist. The modal lets the recruiter preview
//     and edit an email before sending, or dismiss the suggestion.
//   - "Add to Shortlist" is gone from this section (recruiter handles via modal).
// ─────────────────────────────────────────────────────────────────────────────

export default function ReasoningPanel({ result, applicant }) {
  const [referralTarget, setReferralTarget] = useState<null | {
    job_id: string;
    job_title: string;
    estimated_score: number;
    match_reason: string;
  }>(null);

  return (
    <div className="border-t border-border px-5 py-5 bg-muted/20 space-y-5 animate-fade-in">

      {/* ── Score Breakdown ── */}
      <div>
        <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-3">
          Score Breakdown
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ScoreBar label="Skills Match" score={result.skills_score}   weight={result.screening_weights_used?.skills} />
          <ScoreBar label="Experience"   score={result.experience_score} weight={result.screening_weights_used?.experience} />
          <ScoreBar label="Education"    score={result.education_score}  weight={result.screening_weights_used?.education} />
          <ScoreBar label="Relevance"    score={result.relevance_score}  weight={result.screening_weights_used?.relevance} />
        </div>
      </div>

      {/* ── Strengths & Gaps ── */}
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
            <XCircle className="w-3.5 h-3.5 text-destructive" /> Gaps &amp; Risks
          </h4>
          <ul className="space-y-1.5">
            {(result.gaps || []).map((g, i) => {
              const text = typeof g === "string" ? g : (g?.description || "");
              const isDeadbreaker = typeof g === "object" && g?.type === "dealbreaker";
              return (
                <li key={i} className="text-xs text-foreground flex items-start gap-2">
                  <span className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isDeadbreaker ? "bg-destructive" : "bg-warning"}`} />
                  <span>
                    {text}
                    {isDeadbreaker && (
                      <span className="ml-1 text-[10px] text-destructive font-medium">(dealbreaker)</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ── AI Recommendation ── */}
      {result.recommendation && (
        <div className="bg-card rounded-lg border border-border p-4">
          <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-primary" /> AI Recommendation
          </h4>
          <p className="text-sm text-foreground leading-relaxed">{result.recommendation}</p>
        </div>
      )}

      {/* ── Bias Flags ── */}
      {(result.bias_flags || []).length > 0 && (
        <div className="bg-warning/5 rounded-lg border border-warning/20 p-4">
          <h4 className="font-heading font-semibold text-xs text-warning uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Bias / Confidence Alerts
          </h4>
          <ul className="space-y-1">
            {result.bias_flags.map((f, i) => (
              <li key={i} className="text-xs text-foreground">{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Other Matching Roles ── */}
      {(result.other_matching_roles || []).length > 0 && (
        <div>
          <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-primary" /> Also a Potential Fit For
          </h4>
          <p className="text-[10px] text-muted-foreground mb-3">
            AI matched this candidate to other open roles at 80%+ — click a role to reach out or dismiss.
          </p>
          <div className="flex flex-col gap-2">
            {result.other_matching_roles.map((r, i) => (
              <button
                key={i}
                onClick={() => setReferralTarget(r)}
                className="group flex items-center justify-between px-3 py-2.5 bg-card border border-border hover:border-primary/50 hover:bg-primary/5 rounded-lg transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  {/* Score pill */}
                  <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                    r.estimated_score >= 90
                      ? "bg-accent/10 text-accent border-accent/20"
                      : "bg-primary/10 text-primary border-primary/20"
                  }`}>
                    {r.estimated_score}%
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{r.job_title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {r.match_reason}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Candidate Feedback Draft ── */}
      {result.candidate_feedback && (
        <div>
          <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" /> Candidate Feedback (Draft)
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            {result.candidate_feedback}
          </p>
        </div>
      )}

      {/* ── Role Referral Modal ── */}
      {referralTarget && (
        <RoleReferralModal
          candidate={applicant}
          appliedRole={result.job_title ?? "the applied role"}
          suggestedRole={referralTarget}
          onClose={() => setReferralTarget(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoleReferralModal
// Lets the recruiter preview + edit an email before sending to the candidate,
// or dismiss the suggestion entirely.
// ─────────────────────────────────────────────────────────────────────────────

function RoleReferralModal({
  candidate,
  appliedRole,
  suggestedRole,
  onClose,
}: {
  candidate: any;
  appliedRole: string;
  suggestedRole: { job_id: string; job_title: string; estimated_score: number; match_reason: string };
  onClose: () => void;
}) {
  const { toast } = useToast();

  const candidateName  = candidate?.full_name  ?? "the candidate";
  const candidateEmail = candidate?.email ?? "";

  // Default subject and body — recruiter can edit both
  const defaultSubject = `Exciting opportunity: ${suggestedRole.job_title} at our company`;
  const defaultBody = `Hi ${candidateName},

Thank you for applying for the ${appliedRole} position. After reviewing your profile, we believe your background could be an excellent fit for another open role we have: ${suggestedRole.job_title}.

${suggestedRole.match_reason}

We'd love to discuss this opportunity with you. Would you be open to a quick call to explore this further?

Please reply to this email or let us know if you have any questions.

Best regards,
TalentScreen HR Team`;

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody]       = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleSend = async () => {
    if (!candidateEmail) {
      toast({ title: "No email address on file for this candidate", variant: "destructive" });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Subject and message body cannot be empty", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/interviews/role-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to:            candidateEmail,
          candidateName,
          appliedRole,
          suggestedRole: suggestedRole.job_title,
          subject,
          body,
        }),
      });

      if (!res.ok) throw new Error("Send failed");

      toast({
        title: "Email sent",
        description: `${candidateName} has been notified about the ${suggestedRole.job_title} role.`,
      });
      onClose();
    } catch {
      toast({ title: "Failed to send email — please try again", variant: "destructive" });
    }
    setSending(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Small delay so the state change is visible before close
    setTimeout(onClose, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl animate-fade-in flex flex-col"
        style={{ maxHeight: "90vh" }}
      >

        {/* ── Modal header ── */}
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Briefcase className="w-4 h-4 text-primary" />
              <h2 className="font-heading font-bold text-sm">Role Suggestion</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Reach out to <span className="font-medium text-foreground">{candidateName}</span>{" "}
              about the <span className="font-medium text-foreground">{suggestedRole.job_title}</span> role
              &nbsp;·&nbsp;
              <span className={`font-semibold ${suggestedRole.estimated_score >= 90 ? "text-accent" : "text-primary"}`}>
                {suggestedRole.estimated_score}% match
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── AI reason chip ── */}
        <div className="px-5 pt-4 shrink-0">
          <div className="flex items-start gap-2 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-primary mt-0.5 shrink-0">✦</span>
            <p className="text-xs text-primary leading-relaxed">{suggestedRole.match_reason}</p>
          </div>
        </div>

        {/* ── Email editor ── */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Email Preview — edit before sending
          </p>

          {/* To field (read-only) */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">To</label>
            <div className="px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs text-foreground">
              {candidateEmail || (
                <span className="text-destructive">No email on file — add one to the candidate profile first</span>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all resize-none font-mono"
            />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between gap-2 p-5 pt-0 border-t border-border shrink-0">
          <button
            onClick={handleDismiss}
            disabled={sending || dismissed}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted disabled:opacity-50"
          >
            {dismissed ? "Dismissed" : "Dismiss suggestion"}
          </button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || !candidateEmail}
              className="gap-1.5"
            >
              {sending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-3.5 h-3.5" /> Send Email</>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScoreBar (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, weight }) {
  return (
    <div className="bg-card rounded-lg border border-border p-3 text-center">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold font-heading">{score || 0}</p>
      {weight && <p className="text-[10px] text-muted-foreground">Weight: {weight}%</p>}
    </div>
  );
}
