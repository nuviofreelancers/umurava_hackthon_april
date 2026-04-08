import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, X, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function CandidateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [form, setForm] = useState(null);

  useEffect(() => {
    async function load() {
      const results = [await applicantsApi.get(id)];
      if (results.length > 0) setForm(results[0]);
      setLoading(false);
    }
    load();
  }, [id]);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addSkill = () => {
    if (skillInput.trim() && !(form.skills || []).includes(skillInput.trim())) {
      update("skills", [...(form.skills || []), skillInput.trim()]);
      setSkillInput("");
    }
  };

  const save = async () => {
    setSaving(true);
    const fields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
    const filled = fields.filter(f => { const v = form[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });
    await applicantsApi.update(id, {
      ...form,
      profile_completeness: Math.round((filled.length / fields.length) * 100),
    });
    toast({ title: "Candidate updated" });
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!form) return <p className="text-center text-muted-foreground py-16">Candidate not found</p>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-heading font-bold">{form.full_name}</h1>
          {form.current_role && <p className="text-sm text-muted-foreground">{form.current_role}{form.current_company ? ` at ${form.current_company}` : ""}</p>}
        </div>
      </div>

      {/* Form */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Full Name *</Label>
            <Input value={form.full_name || ""} onChange={e => update("full_name", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={form.email || ""} onChange={e => update("email", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={form.phone || ""} onChange={e => update("phone", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <Input value={form.location || ""} onChange={e => update("location", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Current Role</Label>
            <Input value={form.current_role || ""} onChange={e => update("current_role", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Current Company</Label>
            <Input value={form.current_company || ""} onChange={e => update("current_company", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Experience (years)</Label>
            <Input type="number" value={form.experience_years || 0} onChange={e => update("experience_years", Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Education Level</Label>
            <Select value={form.education_level || "None"} onValueChange={v => update("education_level", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["None", "High School", "Associate", "Bachelor", "Master", "PhD"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Education Field</Label>
            <Input value={form.education_field || ""} onChange={e => update("education_field", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Portfolio URL</Label>
            <Input value={form.portfolio_url || ""} onChange={e => update("portfolio_url", e.target.value)} className="mt-1" placeholder="https://..." />
          </div>
        </div>

        {/* Skills */}
        <div>
          <Label className="text-xs">Skills</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              placeholder="Add skill..."
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
            />
            <Button type="button" variant="outline" size="icon" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(form.skills || []).map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[11px] font-medium">
                {s} <button onClick={() => update("skills", form.skills.filter(x => x !== s))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90 gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </Button>
      </div>
    </div>
  );
}