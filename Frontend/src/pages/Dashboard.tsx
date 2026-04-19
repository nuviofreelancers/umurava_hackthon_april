import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchJobs } from "@/store/jobSlice";
import { fetchApplicants } from "@/store/applicantsSlice";
import { fetchResults } from "@/store/resultsSlice";
import { Briefcase, Users, Sparkles, TrendingUp, ArrowRight } from "lucide-react";
import StatCard from "../components/StatCard";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const dispatch = useDispatch();
  const jobsList        = useSelector(s => s.jobs.list);
  const applicantsList  = useSelector(s => s.applicants.list);
  const resultsList     = useSelector(s => s.results.list);
  const loading         = useSelector(s => s.jobs.loading);

  useEffect(() => {
    dispatch(fetchJobs());
    dispatch(fetchApplicants());
    dispatch(fetchResults());
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const activeJobs    = jobsList.filter(j => j.status === "Active");
  const screenedJobs  = jobsList.filter(j => j.last_screened_at);
  const avgScore      = resultsList.length > 0
    ? Math.round(resultsList.reduce((s, r) => s + (r.match_score || 0), 0) / resultsList.length)
    : 0;
  const recentResults = [...resultsList]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">AI-powered talent screening overview</p>
        </div>
        <Link to="/jobs/new">
          <Button className="bg-primary hover:bg-primary/90 gap-2">
            <Briefcase className="w-4 h-4" />
            New Job Posting
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Briefcase}   label="Active Jobs"       value={activeJobs.length}    subtitle={`${jobsList.length} total`} />
        <StatCard icon={Users}       label="Total Candidates"  value={applicantsList.length} subtitle="Across all jobs" />
        <StatCard icon={Sparkles}    label="Screenings Run"    value={screenedJobs.length}  subtitle="Jobs screened by AI" />
        <StatCard icon={TrendingUp}  label="Avg Match Score"   value={avgScore || "—"}      subtitle="Across all results" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-semibold">Active Jobs</h2>
            <Link to="/jobs" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {activeJobs.length === 0 ? (
              <p className="px-5 py-8 text-center text-muted-foreground text-sm">No active jobs yet</p>
            ) : (
              activeJobs.slice(0, 5).map(job => {
                const count = applicantsList.filter(a => {
                  const aJobId = (a as any).jobId || (a as any).job_id;
                  return String(aJobId) === String(job.id) || String(aJobId) === String((job as any)._id);
                }).length;
                return (
                  <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center px-5 py-3.5 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(job as any).experience_level} · {count} applicant{count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-semibold">Recent Top Candidates</h2>
            <Link to="/screening" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentResults.length === 0 ? (
              <p className="px-5 py-8 text-center text-muted-foreground text-sm">No screening results yet</p>
            ) : (
              recentResults.map(r => (
                <div key={r.id} className="flex items-center px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.applicant_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Rank #{r.rank}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border ${
                    r.match_score >= 80 ? 'text-accent bg-accent/10 border-accent/20' :
                    r.match_score >= 60 ? 'text-primary bg-primary/10 border-primary/20' :
                    'text-warning bg-warning/10 border-warning/20'
                  }`}>
                    {r.match_score}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
