import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchJobs } from "@/store/jobSlice";
import { fetchResults } from "@/store/resultsSlice";
import { fetchApplicants } from "@/store/applicantsSlice";
import { Sparkles, Briefcase, ArrowRight, Clock, CalendarPlus, Filter, X } from "lucide-react";
import EmptyState from "../components/EmptyState";
import ScheduleInterviewModal from "../components/ScheduleInterviewModal";
import moment from "moment";

const SOURCE_COLORS: Record<string, string> = {
  LinkedIn:       "bg-blue-50 text-blue-700 border-blue-200",
  Upwork:         "bg-green-50 text-green-700 border-green-200",
  Umurava:        "bg-violet-50 text-violet-700 border-violet-200",
  "Direct Upload":"bg-slate-50 text-slate-600 border-slate-200",
  Referral:       "bg-amber-50 text-amber-700 border-amber-200",
  csv:            "bg-teal-50 text-teal-700 border-teal-200",
  json:           "bg-cyan-50 text-cyan-700 border-cyan-200",
  pdf:            "bg-red-50 text-red-700 border-red-200",
  docx:           "bg-indigo-50 text-indigo-700 border-indigo-200",
  url:            "bg-orange-50 text-orange-700 border-orange-200",
  manual:         "bg-gray-50 text-gray-600 border-gray-200",
};

function sourceChipClass(source: string): string {
  return SOURCE_COLORS[source] ?? "bg-muted text-muted-foreground border-border";
}

export default function Screening() {
  const dispatch   = useDispatch();
  const jobs       = useSelector((s: any) => s.jobs.list);
  const results    = useSelector((s: any) => s.results.list);
  const applicants = useSelector((s: any) => s.applicants.list);
  const loading    = useSelector((s: any) => s.jobs.loading);

  const [scheduling, setScheduling]       = useState<any>(null);
  const [sourceFilter, setSourceFilter]   = useState<string>("all");

  useEffect(() => {
    dispatch(fetchJobs() as any);
    dispatch(fetchResults() as any);
    dispatch(fetchApplicants() as any);
  }, [dispatch]);

  const screenedJobs = jobs.filter((j: any) => j.last_screened_at);

  // Collect all unique sources from applicants that appear in screened results
  const allSources = useMemo(() => {
    const resultApplicantIds = new Set(results.map((r: any) => r.applicant_id));
    const sources = applicants
      .filter((a: any) => resultApplicantIds.has(a.id))
      .map((a: any) => a.source || a.sourceType || "manual")
      .filter(Boolean);
    return Array.from(new Set(sources)) as string[];
  }, [applicants, results]);

  // Filter results by selected source
  const filteredResults = useMemo(() => {
    if (sourceFilter === "all") return results;
    return results.filter((r: any) => {
      const applicant = applicants.find((a: any) => a.id === r.applicant_id);
      const src = applicant?.source || applicant?.sourceType || "manual";
      return src === sourceFilter;
    });
  }, [results, applicants, sourceFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">AI Screening</h1>
          <p className="text-muted-foreground mt-1">View and manage AI screening results across all jobs</p>
        </div>
      </div>

      {/* ── Source filter bar ── */}
      {allSources.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Filter className="w-3.5 h-3.5" /> Source:
          </span>
          <button
            onClick={() => setSourceFilter("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              sourceFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            All ({results.length})
          </button>
          {allSources.map(src => {
            const count = filteredResults.filter((r: any) => {
              const a = applicants.find((ap: any) => ap.id === r.applicant_id);
              return (a?.source || a?.sourceType || "manual") === src;
            }).length;
            return (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  sourceFilter === src
                    ? "bg-primary text-primary-foreground border-primary"
                    : `${sourceChipClass(src)} hover:border-primary/40`
                }`}
              >
                {src} ({count})
              </button>
            );
          })}
          {sourceFilter !== "all" && (
            <button
              onClick={() => setSourceFilter("all")}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {screenedJobs.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No screenings yet"
          description="Go to a job posting and run AI screening to see results here"
          action={
            <Link to="/jobs">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                View Jobs
              </button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {screenedJobs.map((job: any) => {
            // Use filtered results for this job
            const jobResults = filteredResults
              .filter((r: any) => r.job_id === job.id)
              .sort((a: any, b: any) => a.rank - b.rank);

            // But use ALL results for the summary stats (unaffected by source filter)
            const allJobResults = results.filter((r: any) => r.job_id === job.id);
            const avgScore = allJobResults.length > 0
              ? Math.round(allJobResults.reduce((s: number, r: any) => s + r.match_score, 0) / allJobResults.length)
              : 0;

            const topCandidates = jobResults.slice(0, 3);

            // Don't show job card if source filter leaves it empty — unless showing all
            if (sourceFilter !== "all" && jobResults.length === 0) return null;

            return (
              <div key={job.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Job header */}
                <Link
                  to={`/jobs/${job.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-primary" />
                      <h3 className="font-heading font-semibold">{job.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        {sourceFilter !== "all"
                          ? `${jobResults.length} of ${allJobResults.length} candidates`
                          : `${allJobResults.length} candidates ranked`}
                      </span>
                      <span>·</span>
                      <span>Avg score: {avgScore}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {moment(job.last_screened_at).fromNow()}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
                </Link>

                {/* Top candidates */}
                {topCandidates.length > 0 && (
                  <div className="px-5 pb-4 border-t border-border pt-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                      Top candidates{sourceFilter !== "all" ? ` · ${sourceFilter}` : ""}
                    </p>
                    <div className="space-y-2">
                      {topCandidates.map((r: any) => {
                        const applicant = applicants.find((a: any) => a.id === r.applicant_id);
                        const src = applicant?.source || applicant?.sourceType || "manual";
                        return (
                          <div key={r.id} className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                              r.match_score >= 80 ? "text-accent bg-accent/10 border-accent/20" :
                              r.match_score >= 60 ? "text-primary bg-primary/10 border-primary/20" :
                              "text-warning bg-warning/10 border-warning/20"
                            }`}>
                              {r.match_score}
                            </div>
                            <span className="text-xs font-medium flex-1">{r.applicant_name}</span>
                            {/* Source badge */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${sourceChipClass(src)}`}>
                              {src}
                            </span>
                            {applicant && (
                              <button
                                onClick={() => setScheduling({ applicant, jobTitle: job.title })}
                                title="Schedule Interview"
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition-all"
                              >
                                <CalendarPlus className="w-3.5 h-3.5" />
                                Schedule
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {scheduling && (
        <ScheduleInterviewModal
          applicant={scheduling.applicant}
          jobTitle={scheduling.jobTitle}
          onClose={() => setScheduling(null)}
          onScheduled={() => setScheduling(null)}
        />
      )}
    </div>
  );
}
