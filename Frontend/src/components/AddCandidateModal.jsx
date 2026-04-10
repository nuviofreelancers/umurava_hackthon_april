import { useState } from "react";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Loader2, Upload, PenLine } from "lucide-react";
import ApplicantUpload from "./ApplicantUpload";
import { useToast } from "@/components/ui/use-toast";

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function AddCandidateModal({ jobs, onClose, onAdded }) {
  const { toast } = useToast();
  const [saving, setSaving]     = useState(false);
  const [uploadMode, setUploadMode] = useState(false);
  const [skillInput, setSkillInput] = useState({ name: "", level: "Intermediate" });
  const [form, setForm] = useState({
    job_id: "", full_name: "", email: "", phone: "", location: "",
    skills: [], experience_years: 0, education_level: "Bachelor",
    education_field: "", current_role: "", current_company: "", portfolio_url: "",
    availability: { status: "Available", type: "Full-time" },
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addSkill = () => {
    const name = skillInput.name.trim();
    if (!name) return;
    const existing = form.skills.map(s => typeof s === "string" ? s : s.name);
    if (!existing.includes(name)) {
      update("skills", [...form.skills, { name, level: skillInput.level, yearsOfExperience: 0 }]);
    }
    setSkillInput({ name: "", level: "Intermediate" });
  };

  const removeSkill = (name) => update("skills", form.skills.filter(s => (typeof s === "string" ? s : s.name) !== name));

  const save = async () => {
    if (!form.full_name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!form.job_id) { toast({ title: "Please select a job", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const coreFields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
      const filled = coreFields.filter(f => { const v = form[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });
      await applicantsApi.create({
        ...form,
        source: "Manual Entry",
        profile_completeness: Math.round((filled.length / coreFields.length) * 100),
      });
      toast({ title: "Candidate added" });
      onAdded?.();
      onClose();
    } catch {
      toast({ title: "Failed to add candidate", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-xl animate-fade-in my-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-heading font-bold text-base">Add Candidate</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUploadMode(m => !m)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors text-muted-foreground"
            >
              {uploadMode ? <><PenLine className="w-3.5 h-3.5" /> Manual Entry</> : <><Upload className="w-3.5 h-3.5" /> Upload CSV / PDF</>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label className="text-xs">Job Posting *</Label>
            <Select value={form.job_id} onValueChange={v => update("job_id", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select a job..." /></SelectTrigger>
              <SelectContent>
                {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {uploadMode ? (
            <ApplicantUpload jobId={form.job_id} onUploaded={() => { onAdded?.(); onClose(); }} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Full Name *</Label><Input value={form.full_name} onChange={e => update("full_name", e.target.value)} className="mt-1" placeholder="John Doe" /></div>
                <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => update("email", e.target.value)} className="mt-1" placeholder="john@example.com" /></div>
                <div><Label className="text-xs">Current Role</Label><Input value={form.current_role} onChange={e => update("current_role", e.target.value)} className="mt-1" placeholder="Software Engineer" /></div>
                <div><Label className="text-xs">Current Company</Label><Input value={form.current_company} onChange={e => update("current_company", e.target.value)} className="mt-1" placeholder="TechCorp" /></div>
                <div><Label className="text-xs">Experience (years)</Label><Input type="number" value={form.experience_years} onChange={e => update("experience_years", Number(e.target.value))} className="mt-1" /></div>
                <div>
                  <Label className="text-xs">Education Level</Label>
                  <Select value={form.education_level} onValueChange={v => update("education_level", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["None","High School","Associate","Bachelor","Master","PhD"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Location</Label><Input value={form.location} onChange={e => update("location", e.target.value)} className="mt-1" placeholder="Kigali, Rwanda" /></div>
                <div><Label className="text-xs">Portfolio / LinkedIn</Label><Input value={form.portfolio_url} onChange={e => update("portfolio_url", e.target.value)} className="mt-1" placeholder="https://..." /></div>
              </div>

              {/* Skills — Umurava schema objects */}
              <div>
                <Label className="text-xs">Skills</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={skillInput.name}
                    onChange={e => setSkillInput(p => ({ ...p, name: e.target.value }))}
                    placeholder="Skill name..."
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    className="flex-1"
                  />
                  <Select value={skillInput.level} onValueChange={v => setSkillInput(p => ({ ...p, level: v }))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{SKILL_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.skills.map(s => {
                    const name = typeof s === "string" ? s : s.name;
                    const level = typeof s === "string" ? "" : s.level;
                    return (
                      <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[11px] font-medium">
                        {name}{level ? ` · ${level}` : ""}
                        <button onClick={() => removeSkill(name)}><X className="w-3 h-3" /></button>
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {!uploadMode && (
          <div className="flex items-center justify-end gap-2 p-5 pt-0">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : "Add Candidate"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
