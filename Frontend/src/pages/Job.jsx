import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { jobs as jobsApi } from "@/api/backend";
import { Briefcase, Plus, Search, Filter, Users, Sparkles, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "../components/EmptyState";

const statusColors = {
  Draft: "bg-muted text-muted-foreground",
  Active: "bg-accent/10 text-accent",
  Paused: "bg-warning/10 text-warning",
  Closed: "bg-destructive/10 text-destructive",
};

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const data = await jobsApi.list().then(data => { setJobs(data); setLoading(false); });
      setJobs(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = jobs.filter(j => {
    const matchesSearch = !search || j.title?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground mt-1">{jobs.length} job postings</p>
        </div>
        <Link to="/jobs/new">
          <Button className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" />
            Create Job
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search jobs..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "Active", "Draft", "Paused", "Closed"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Job Cards */}
      {filtered.length === 0 ? (
        <EmptyState 
          icon={Briefcase}
          title="No jobs found"
          description={jobs.length === 0 ? "Create your first job posting to start screening candidates" : "Try adjusting your filters"}
          action={jobs.length === 0 && (
            <Link to="/jobs/new">
              <Button className="bg-primary hover:bg-primary/90 gap-2">
                <Plus className="w-4 h-4" /> Create Job
              </Button>
            </Link>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(job => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusColors[job.status] || statusColors.Draft}`}>
                  {job.status || "Draft"}
                </span>
                {job.last_screened_at && (
                  <Sparkles className="w-4 h-4 text-accent" />
                )}
              </div>
              <h3 className="font-heading font-semibold text-base group-hover:text-primary transition-colors">{job.title}</h3>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {job.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                )}
                {job.experience_level && (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.experience_level}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(job.required_skills || []).slice(0, 4).map(skill => (
                  <span key={skill} className="px-2 py-0.5 bg-muted rounded text-[11px] text-muted-foreground">
                    {skill}
                  </span>
                ))}
                {(job.required_skills || []).length > 4 && (
                  <span className="px-2 py-0.5 text-[11px] text-muted-foreground">+{job.required_skills.length - 4}</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> {job.applicant_count || 0} applicants
                </span>
                <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View Details →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}