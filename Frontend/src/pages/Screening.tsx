import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchJobs } from "@/store/jobSlice";
import { fetchResults } from "@/store/resultsSlice";
import { fetchApplicants } from "@/store/applicantsSlice";
import { Sparkles, Briefcase, ArrowRight, Clock, CalendarPlus } from "lucide-react";
import EmptyState from "../components/EmptyState";
import ScheduleInterviewModal from "../components/ScheduleInterviewModal";
import moment from "moment";

export default function Screening() {
  const dispatch = useDispatch();
  const jobs      = useSelector(s => s.jobs.list);
  const results   = useSelector(s => s.results.list);
  const applicants = useSelector(s => s.applicants.list);
  const loading   = useSelector(s => s.jobs.loading);

  const [scheduling, setScheduling] = useState(null); // { applicant, jobTitle }

  useEffect(() => {
    dispatch(fetchJobs());
    dispatch(fetchResults());
    dispatch(fetchApplicants());
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
            const jobResults    = results.filter(r => r.job_id === job.id).sort((a, b) => a.rank - b.rank);
            const topCandidates = jobResults.slice(0, 3);
            const avgScore      = jobResults.length > 0
              ? Math.round(jobResults.reduce((s, r) => s + r.match_score, 0) / jobResults.length)
              : 0;

            return (
              <div key={job.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Job header — clickable to job detail */}
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
                </Link>

                {/* Top candidates with schedule buttons */}
                {topCandidates.length > 0 && (
                  <div className="px-5 pb-4 border-t border-border pt-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Top candidates</p>
                    <div className="space-y-2">
                      {topCandidates.map(r => {
                        const applicant = applicants.find(a => a.id === r.applicant_id);
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
