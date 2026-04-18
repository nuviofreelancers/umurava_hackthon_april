import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jobs as jobsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Loader2, CheckCircle, Briefcase, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = ["Draft", "Active", "Paused", "Closed"];
const EXP_OPTIONS    = ["Junior", "Mid-Level", "Senior", "Lead", "Manager"];
const EMP_OPTIONS    = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"];

export default function JobCsvPreview() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobs, setJobs]       = useState([]);
  const [selected, setSelected] = useState(0);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("csv_jobs_preview");
      if (raw) {
        const parsed = JSON.parse(raw);
        setJobs(parsed);
      } else {
        navigate("/jobs/new");
      }
    } catch {
      navigate("/jobs/new");
    }
  }, []);

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No jobs to preview.
      </div>
    );
  }

  const updateJob = (field, value) => {
    setJobs(prev => prev.map((j, i) => i === selected ? { ...j, [field]: value } : j));
    setDirty(true);
  };

  const removeJob = (idx) => {
    const updated = jobs.filter((_, i) => i !== idx);
    setJobs(updated);
    setSelected(Math.min(selected, updated.length - 1));
    setDirty(false);
  };

  const handleImport = async () => {
    const valid = jobs.filter(j => j.title?.trim() && j.description);
    if (valid.length === 0) {
      toast({ title: "No valid jobs", description: "Each job must have a title and description.", variant: "destructive" });
      return;
    }
    setSaving(true);
    let created = 0;
    for (const job of valid) {
      try {
        await jobsApi.create({
          ...job,
          required_skills: Array.isArray(job.required_skills)
            ? job.required_skills
            : (job.required_skills || "").split(",").map(s => s.trim()).filter(Boolean),
          preferred_skills: Array.isArray(job.preferred_skills)
            ? job.preferred_skills
            : (job.preferred_skills || "").split(",").map(s => s.trim()).filter(Boolean),
          salary_range_min: Number(job.salary_range_min) || 0,
          salary_range_max: Number(job.salary_range_max) || 0,
          currency_symbol: job.currency_symbol || "$",
          status: job.status || "Draft",
          screening_weights: { skills: 40, experience: 30, education: 15, relevance: 15 },
        });
        created++;
      } catch { /* skip invalid */ }
    }
    sessionStorage.removeItem("csv_jobs_preview");
    setSaving(false);
    toast({ title: `${created} job${created > 1 ? "s" : ""} created successfully` });
    navigate("/jobs");
  };

  const job = jobs[selected];
  const validCount = jobs.filter(j => j.title?.trim()).length;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/jobs/new")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Preview Imported Jobs</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {validCount} of {jobs.length} valid — review and edit before importing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/jobs/new")}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={saving || validCount === 0}
            className="bg-primary hover:bg-primary/90 gap-2"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
              : <><CheckCircle className="w-4 h-4" /> Import {validCount} Job{validCount !== 1 ? "s" : ""}</>
            }
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 gap-5 min-h-0">
        {/* Sidebar — job list */}
        <aside className="w-64 shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Jobs</p>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {jobs.map((j, idx) => {
              const isValid = !!j.title?.trim();
              const isActive = idx === selected;
              return (
                <button
                  key={idx}
                  onClick={() => { setSelected(idx); setDirty(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {isValid
                    ? <Briefcase className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    : <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
                  }
                  <span className="text-sm font-medium truncate flex-1">
                    {j.title?.trim() || <span className="italic text-muted-foreground">Untitled</span>}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); removeJob(idx); }}
                    className={`p-0.5 rounded transition-colors text-muted-foreground hover:text-destructive shrink-0 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main panel — editable job details */}
        <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden min-w-0">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="font-heading font-semibold text-base">
                {job.title?.trim() || <span className="text-muted-foreground italic">Untitled job</span>}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Job {selected + 1} of {jobs.length}</p>
            </div>
            <button
              onClick={() => removeJob(selected)}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Remove this job"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable fields */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div className="sm:col-span-2">
                <Label className="text-xs">Job Title *</Label>
                <Input
                  value={job.title ?? ""}
                  onChange={e => updateJob("title", e.target.value)}
                  className="mt-1"
                  placeholder="e.g. Senior Backend Engineer"
                />
              </div>

              <div>
                <Label className="text-xs">Department</Label>
                <Input value={job.department ?? ""} onChange={e => updateJob("department", e.target.value)} className="mt-1" placeholder="Engineering" />
              </div>

              <div>
                <Label className="text-xs">Location</Label>
                <Input value={job.location ?? ""} onChange={e => updateJob("location", e.target.value)} className="mt-1" placeholder="Kigali, Rwanda" />
              </div>

              <div>
                <Label className="text-xs">Employment Type</Label>
                <Select value={job.employment_type || ""} onValueChange={v => updateJob("employment_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{EMP_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Experience Level</Label>
                <Select value={job.experience_level || ""} onValueChange={v => updateJob("experience_level", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{EXP_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Salary Min</Label>
                <Input type="number" value={job.salary_range_min ?? ""} onChange={e => updateJob("salary_range_min", e.target.value)} className="mt-1" placeholder="0" />
              </div>

              <div>
                <Label className="text-xs">Salary Max</Label>
                <Input type="number" value={job.salary_range_max ?? ""} onChange={e => updateJob("salary_range_max", e.target.value)} className="mt-1" placeholder="0" />
              </div>

              <div>
                <Label className="text-xs">Currency</Label>
                <Input value={job.currency_symbol ?? "$"} onChange={e => updateJob("currency_symbol", e.target.value)} className="mt-1" placeholder="$" />
              </div>

              <div>
                <Label className="text-xs">Status</Label>
                <Select value={job.status || "Draft"} onValueChange={v => updateJob("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Required Skills <span className="text-muted-foreground">(comma-separated)</span></Label>
                <Input
                  value={Array.isArray(job.required_skills) ? job.required_skills.join(", ") : (job.required_skills || "")}
                  onChange={e => updateJob("required_skills", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  className="mt-1"
                  placeholder="React, Node.js, PostgreSQL"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Preferred Skills <span className="text-muted-foreground">(comma-separated)</span></Label>
                <Input
                  value={Array.isArray(job.preferred_skills) ? job.preferred_skills.join(", ") : (job.preferred_skills || "")}
                  onChange={e => updateJob("preferred_skills", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  className="mt-1"
                  placeholder="Docker, AWS, TypeScript"
                />
              </div>
            </div>
          </div>

          {/* Save/cancel actions for current card */}
          {dirty && (
            <div className="shrink-0 px-6 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Unsaved changes</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setDirty(false)}>Cancel</Button>
                <Button size="sm" onClick={() => setDirty(false)}>Save</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
