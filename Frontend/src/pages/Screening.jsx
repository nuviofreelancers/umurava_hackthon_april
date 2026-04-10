import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchJobs } from "@/store/jobSlice";
import { fetchResults } from "@/store/resultsSlice";
import { Sparkles, Briefcase, ArrowRight, Clock } from "lucide-react";
import EmptyState from "../components/EmptyState";
import moment from "moment";

export default function Screening() {
  const dispatch = useDispatch();
  const jobs    = useSelector(s => s.jobs.list);
  const results = useSelector(s => s.results.list);
  const loading = useSelector(s => s.jobs.loading);

  useEffect(() => {
    dispatch(fetchJobs());
    dispatch(fetchResults());
  }, [dispatch]);

  const screenedJobs = jobs.filter(j => j.last_screened_at);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">AI Screening</h1>
        <p className="text-muted-foreground mt-1">View and manage AI screening results across all jobs</p>
      </div>

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
          {screenedJobs.map(job => {
            const jobResults   = results.filter(r => r.job_id === job.id).sort((a, b) => a.rank - b.rank);
            const topCandidates = jobResults.slice(0, 3);
            const avgScore     = jobResults.length > 0
              ? Math.round(jobResults.reduce((s, r) => s + r.match_score, 0) / jobResults.length)
              : 0;

            return (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="block bg-card rounded-xl border border-border p-5 hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-primary" />
                      <h3 className="font-heading font-semibold">{job.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{jobResults.length} candidates ranked</span>
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
                </div>

                {topCandidates.length > 0 && (
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Top 3:</span>
                    {topCandidates.map(r => (
                      <div key={r.id} className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                          r.match_score >= 80 ? 'text-accent bg-accent/10 border-accent/20' :
                          r.match_score >= 60 ? 'text-primary bg-primary/10 border-primary/20' :
                          'text-warning bg-warning/10 border-warning/20'
                        }`}>
                          {r.match_score}
                        </div>
                        <span className="text-xs font-medium">{r.applicant_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
