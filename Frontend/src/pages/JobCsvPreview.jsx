import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jobs as jobsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Plus, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EDITABLE_FIELDS = [
  { key: "title", label: "Title", required: true },
  { key: "department", label: "Department" },
  { key: "location", label: "Location" },
  { key: "employment_type", label: "Employment Type" },
  { key: "experience_level", label: "Exp. Level" },
  { key: "currency_symbol", label: "Currency" },
  { key: "salary_range_min", label: "Salary Min" },
  { key: "salary_range_max", label: "Salary Max" },
  { key: "status", label: "Status" },
];

export default function JobCsvPreview() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("csv_jobs_preview");
      if (raw) setJobs(JSON.parse(raw));
      else navigate("/jobs/new");
    } catch {
      navigate("/jobs/new");
    }
  }, []);

  const updateJob = (idx, field, value) => {
    setJobs(prev => prev.map((j, i) => i === idx ? { ...j, [field]: value } : j));
  };

  const removeJob = (idx) => {
    setJobs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleImport = async () => {
    const valid = jobs.filter(j => j.title?.trim() && j.description);
    if (valid.length === 0) {
      toast({ title: "No valid jobs", description: "Each job must have at least a title.", variant: "destructive" });
      return;
    }
    setSaving(true);
    let created = 0;
    for (const job of valid) {
      await jobsApi.create({
        ...job,
        required_skills: Array.isArray(job.required_skills) ? job.required_skills : (job.required_skills || "").split(",").map(s => s.trim()).filter(Boolean),
        preferred_skills: Array.isArray(job.preferred_skills) ? job.preferred_skills : (job.preferred_skills || "").split(",").map(s => s.trim()).filter(Boolean),
        salary_range_min: Number(job.salary_range_min) || 0,
        salary_range_max: Number(job.salary_range_max) || 0,
        currency_symbol: job.currency_symbol || "$",
        status: job.status || "Draft",
        screening_weights: { skills: 40, experience: 30, education: 15, relevance: 15 },
      });
      created++;
    }
    sessionStorage.removeItem("csv_jobs_preview");
    setSaving(false);
    toast({ title: `${created} job${created > 1 ? "s" : ""} created successfully` });
    navigate("/jobs");
  };

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No jobs to preview.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/jobs/new")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-heading font-bold">Preview Imported Jobs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{jobs.length} job{jobs.length > 1 ? "s" : ""} parsed — review and edit before importing</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {EDITABLE_FIELDS.map(f => (
                <th key={f.key} className="px-3 py-3 text-left font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}
                </th>
              ))}
              <th className="px-3 py-3 text-left font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wide">Required Skills</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job, idx) => (
              <tr key={idx} className="hover:bg-muted/20 transition-colors">
                {EDITABLE_FIELDS.map(f => (
                  <td key={f.key} className="px-3 py-2">
                    <Input
                      value={job[f.key] ?? ""}
                      onChange={e => updateJob(idx, f.key, e.target.value)}
                      className="h-8 text-xs min-w-[100px]"
                    />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <Input
                    value={Array.isArray(job.required_skills) ? job.required_skills.join(", ") : (job.required_skills || "")}
                    onChange={e => updateJob(idx, "required_skills", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                    className="h-8 text-xs min-w-[150px]"
                    placeholder="comma-separated"
                  />
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => removeJob(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          {jobs.filter(j => j.title?.trim()).length} of {jobs.length} jobs are valid (have a title)
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/jobs/new")}>Cancel</Button>
          <Button onClick={handleImport} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><CheckCircle className="w-4 h-4" /> Import Jobs</>}
          </Button>
        </div>
      </div>
    </div>
  );
}