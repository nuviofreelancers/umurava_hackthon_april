import { useState } from "react";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const BLANK = {
  full_name: "", email: "", phone: "", location: "",
  skills: [], experience_years: 0, education_level: "Bachelor",
  education_field: "", current_role: "", current_company: "", portfolio_url: "",
};

export default function ManualApplicantForm({ jobId, onAdded }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [form, setForm] = useState(BLANK);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addSkill = () => {
    if (skillInput.trim() && !form.skills.includes(skillInput.trim())) {
      update("skills", [...form.skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const save = async () => {
    if (!form.full_name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const fields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
      const filled = fields.filter(f => { const v = form[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });
      await applicantsApi.create({
        ...form, job_id: jobId, source: "Manual Entry",
        profile_completeness: Math.round((filled.length / fields.length) * 100),
      });
      toast({ title: "Candidate added" });
      setForm(BLANK);
      onAdded?.();
    } catch {
      toast({ title: "Failed to add candidate", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
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
        <div><Label className="text-xs">Portfolio URL</Label><Input value={form.portfolio_url} onChange={e => update("portfolio_url", e.target.value)} className="mt-1" placeholder="https://..." /></div>
      </div>
      <div>
        <Label className="text-xs">Skills</Label>
        <div className="flex gap-2 mt-1">
          <Input value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="Add skill..." onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())} />
          <Button type="button" variant="outline" size="icon" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {form.skills.map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[11px] font-medium">
              {s} <button onClick={() => update("skills", form.skills.filter(x => x !== s))}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      </div>
      <Button onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90">
        {saving ? "Adding..." : "Add Candidate"}
      </Button>
    </div>
  );
}
