import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { jobs as jobsApi, uploads } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, X, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CURRENCIES = [
  { symbol: "$", label: "USD ($)" },
  { symbol: "€", label: "EUR (€)" },
  { symbol: "£", label: "GBP (£)" },
  { symbol: "¥", label: "JPY (¥)" },
  { symbol: "₦", label: "NGN (₦)" },
  { symbol: "KSh", label: "KES (KSh)" },
  { symbol: "RWF", label: "RWF (RWF)" },
  { symbol: "R", label: "ZAR (R)" },
  { symbol: "GH₵", label: "GHS (GH₵)" },
  { symbol: "CFA", label: "XOF (CFA)" },
];

export default function JobForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const csvInputRef = useRef(null);
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("edit");
  const [saving, setSaving] = useState(false);
  const [csvParsing, setCsvParsing] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [prefSkillInput, setPrefSkillInput] = useState("");

  const [form, setForm] = useState({
    title: "", department: "", location: "", employment_type: "Full-time",
    experience_level: "Mid", description: "", required_skills: [], preferred_skills: [],
    min_experience_years: 0, education_requirement: "Bachelor",
    salary_range_min: 0, salary_range_max: 0, currency_symbol: "$",
    status: "Draft",
    screening_weights: { skills: 40, experience: 30, education: 15, relevance: 15 },
  });

  useEffect(() => {
    if (editId) {
      jobsApi.get(editId).then(job => {
        setForm({
          title: job.title || "", department: job.department || "",
          location: job.location || "", employment_type: job.employment_type || "Full-time",
          experience_level: job.experience_level || "Mid", description: job.description || "",
          required_skills: job.required_skills || [], preferred_skills: job.preferred_skills || [],
          min_experience_years: job.min_experience_years || 0,
          education_requirement: job.education_requirement || "Bachelor",
          salary_range_min: job.salary_range_min || 0, salary_range_max: job.salary_range_max || 0,
          currency_symbol: job.currency_symbol || "$", status: job.status || "Draft",
          screening_weights: job.screening_weights || { skills: 40, experience: 30, education: 15, relevance: 15 },
        });
      }).catch(() => toast({ title: "Failed to load job", variant: "destructive" }));
    }
  }, [editId]);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addSkill = (type) => {
    const val = type === "required" ? skillInput : prefSkillInput;
    const key = type === "required" ? "required_skills" : "preferred_skills";
    if (val.trim() && !form[key].includes(val.trim())) {
      update(key, [...form[key], val.trim()]);
      type === "required" ? setSkillInput("") : setPrefSkillInput("");
    }
  };

  const removeSkill = (type, skill) => {
    const key = type === "required" ? "required_skills" : "preferred_skills";
    update(key, form[key].filter(s => s !== skill));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await jobsApi.update(editId, form);
        navigate(`/jobs/${editId}`);
      } else {
        const created = await jobsApi.create(form);
        navigate(`/jobs/${created.id}`);
      }
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvParsing(true);
    try {
      const result = await uploads.parseJobs(file);
      if (result?.jobs?.length > 0) {
        sessionStorage.setItem("csv_jobs_preview", JSON.stringify(result.jobs));
        navigate("/jobs/csv-preview");
      } else {
        toast({ title: "Could not parse CSV", description: "No job data found in the file.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setCsvParsing(false);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold">{editId ? "Edit Job" : "Create Job Posting"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Fill in the job details below</p>
          </div>
        </div>
        <div>
          <input ref={csvInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleCsvUpload} />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => csvInputRef.current?.click()} disabled={csvParsing}>
            {csvParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {csvParsing ? "Parsing..." : "Import CSV"}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Job Title *</Label>
            <Input value={form.title} onChange={e => update("title", e.target.value)} className="mt-1.5" placeholder="e.g. Senior Frontend Engineer" />
          </div>
          <div>
            <Label>Department</Label>
            <Input value={form.department} onChange={e => update("department", e.target.value)} className="mt-1.5" placeholder="Engineering" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={e => update("location", e.target.value)} className="mt-1.5" placeholder="Kigali, Rwanda / Remote" />
          </div>
          <div>
            <Label>Employment Type</Label>
            <Select value={form.employment_type} onValueChange={v => update("employment_type", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Full-time", "Part-time", "Contract", "Freelance", "Internship"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Experience Level</Label>
            <Select value={form.experience_level} onValueChange={v => update("experience_level", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Entry", "Junior", "Mid", "Senior", "Lead", "Principal"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Job Description *</Label>
          <Textarea value={form.description} onChange={e => update("description", e.target.value)} className="mt-1.5 min-h-[140px]" placeholder="Describe the role, responsibilities, and what you're looking for..." />
        </div>

        <div>
          <Label>Required Skills</Label>
          <div className="flex gap-2 mt-1.5">
            <Input value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="Add a required skill..."
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill("required"))} />
            <Button type="button" variant="outline" size="icon" onClick={() => addSkill("required")}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {form.required_skills.map(skill => (
              <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {skill}
                <button onClick={() => removeSkill("required", skill)}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <Label>Preferred Skills</Label>
          <div className="flex gap-2 mt-1.5">
            <Input value={prefSkillInput} onChange={e => setPrefSkillInput(e.target.value)} placeholder="Add a preferred skill..."
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill("preferred"))} />
            <Button type="button" variant="outline" size="icon" onClick={() => addSkill("preferred")}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {form.preferred_skills.map(skill => (
              <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                {skill}
                <button onClick={() => removeSkill("preferred", skill)}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Min Experience (years)</Label>
            <Input type="number" value={form.min_experience_years} onChange={e => update("min_experience_years", Number(e.target.value))} className="mt-1.5" />
          </div>
          <div>
            <Label>Education Requirement</Label>
            <Select value={form.education_requirement} onValueChange={v => update("education_requirement", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["None", "High School", "Associate", "Bachelor", "Master", "PhD"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => update("status", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Draft", "Active", "Paused", "Closed"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Currency</Label>
          <Select value={form.currency_symbol} onValueChange={v => update("currency_symbol", v)}>
            <SelectTrigger className="mt-1.5 max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {CURRENCIES.map(c => (
                <SelectItem key={c.symbol} value={c.symbol}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Salary Range Min ({form.currency_symbol})</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{form.currency_symbol}</span>
              <Input type="number" value={form.salary_range_min} onChange={e => update("salary_range_min", Number(e.target.value))} className="pl-8" />
            </div>
          </div>
          <div>
            <Label>Salary Range Max ({form.currency_symbol})</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{form.currency_symbol}</span>
              <Input type="number" value={form.salary_range_max} onChange={e => update("salary_range_max", Number(e.target.value))} className="pl-8" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
          {saving ? "Saving..." : editId ? "Update Job" : "Create Job"}
        </Button>
      </div>
    </div>
  );
}
