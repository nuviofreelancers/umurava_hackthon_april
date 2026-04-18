import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download, GitCompare, CalendarPlus } from "lucide-react";
import ScoreBadge from "./ScoreBadge";
import ConfidenceBadge from "./ConfidenceBadge";
import ReasoningPanel from "./ReasoningPanel";
import EmptyState from "./EmptyState";
import ScheduleInterviewModal from "./ScheduleInterviewModal";
import { Sparkles } from "lucide-react";


export default function ShortlistView({ results, applicants, job }) {
  const [expanded, setExpanded]     = useState(null);
  const [selected, setSelected]     = useState([]);
  const [showTop, setShowTop]       = useState(10);
  const [sortBy, setSortBy]         = useState("rank");
  const [scheduling, setScheduling] = useState(false); // open the modal

  const sorted = [...results].sort((a, b) => {
    if (sortBy === "rank")       return a.rank - b.rank;
    if (sortBy === "score")      return b.match_score - a.match_score;
    if (sortBy === "skills")     return (b.skills_score || 0) - (a.skills_score || 0);
    if (sortBy === "experience") return (b.experience_score || 0) - (a.experience_score || 0);
    return a.rank - b.rank;
  }).slice(0, showTop);

  const toggleSelect = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  // Build the list of applicant objects for the selected candidate IDs
  const selectedApplicants = selected
    .map(id => applicants.find(a => a.id === id))
    .filter(Boolean);

  const exportCSV = () => {
    const headers = ["Rank","Name","Score","Skills","Experience","Education","Relevance","Confidence","Recommendation"];
    const rows = sorted.map(r => [
      r.rank, r.applicant_name, r.match_score, r.skills_score, r.experience_score,
      r.education_score, r.relevance_score, r.confidence_level,
      `"${(r.recommendation || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `shortlist-${job.title.replace(/\s+/g, "-")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (results.length === 0) {
    return <EmptyState icon={Sparkles} title="No screening results yet" description="Run AI screening to see your ranked shortlist" />;
  }

  return (
    <div className="space-y-4">
      {/* ── Controls bar ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {[10, 20].map(n => (
              <button
                key={n}
                onClick={() => setShowTop(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showTop === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card"
          >
            <option value="rank">Sort by Rank</option>
            <option value="score">Sort by Score</option>
            <option value="skills">Sort by Skills</option>
            <option value="experience">Sort by Experience</option>
          </select>
        </div>

        <div className="flex gap-2 items-center">
          {/* Compare — appears when 2+ selected */}
          {selected.length >= 2 && (
            <Link to={`/compare?job=${job.id}&candidates=${selected.join(",")}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <GitCompare className="w-3.5 h-3.5" /> Compare ({selected.length})
              </Button>
            </Link>
          )}

          {/* Schedule — appears when 1+ selected */}
          {selected.length >= 1 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => setScheduling(true)}
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Schedule {selected.length > 1 ? `(${selected.length})` : ""}
            </Button>
          )}

          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* ── Results list ─────────────────────────────────────── */}
      <div className="space-y-3">
        {sorted.map((result) => {
          const isExpanded  = expanded === result.id;
          const isSelected  = selected.includes(result.applicant_id);
          const hasBiasFlags = (result.bias_flags || []).length > 0;

          return (
            <div key={result.id} className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
              <div
                className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : result.id)}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={e => { e.stopPropagation(); toggleSelect(result.applicant_id); }}
                  className="w-4 h-4 rounded border-border"
                  onClick={e => e.stopPropagation()}
                />

                {/* Rank */}
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-xs font-bold text-foreground">#{result.rank}</span>
                </div>

                {/* Score */}
                <ScoreBadge score={result.match_score} size="md" />

                {/* Name & confidence */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{result.applicant_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ConfidenceBadge level={result.confidence_level} />
                    {hasBiasFlags && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">
                        ⚠ Bias flag
                      </span>
                    )}
                  </div>
                </div>

                {/* Mini scores */}
                <div className="hidden md:flex items-center gap-3">
                  <MiniScore label="Skills" value={result.skills_score} />
                  <MiniScore label="Exp"    value={result.experience_score} />
                  <MiniScore label="Edu"    value={result.education_score} />
                  <MiniScore label="Rel"    value={result.relevance_score} />
                </div>
              </div>

              {isExpanded && (
                <ReasoningPanel result={result} applicant={applicants.find(a => a.id === result.applicant_id)} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Schedule modal ───────────────────────────────────── */}
      {scheduling && selectedApplicants.length > 0 && (
        <BulkScheduleModal
          applicants={selectedApplicants}
          jobTitle={job.title}
          onClose={() => setScheduling(false)}
          onDone={() => { setScheduling(false); setSelected([]); }}
        />
      )}
    </div>
  );
}

// ── Bulk scheduling: loops through each selected applicant ────────────────────
function BulkScheduleModal({ applicants, jobTitle, onClose, onDone }) {
  const [index, setIndex] = useState(0);

  // When the current applicant is scheduled, move to the next one (or close)
  const handleScheduled = () => {
    if (index + 1 < applicants.length) {
      setIndex(i => i + 1);
    } else {
      onDone();
    }
  };

  return (
    <>
      {/* Progress indicator when scheduling multiple */}
      {applicants.length > 1 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-card border border-border rounded-full px-4 py-1.5 shadow-lg text-xs font-medium text-muted-foreground animate-fade-in">
          Scheduling {index + 1} of {applicants.length}
        </div>
      )}
      <ScheduleInterviewModal
        applicant={applicants[index]}
        jobTitle={jobTitle}
        onClose={onClose}
        onScheduled={handleScheduled}
      />
    </>
  );
}

function MiniScore({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold">{value || "—"}</p>
    </div>
  );
}
