import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, X, Save, Loader2, Briefcase, GraduationCap, Code, Globe, Award } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SKILL_LEVELS  = ["Beginner", "Intermediate", "Advanced", "Expert"];
const LANG_LEVELS   = ["Basic", "Conversational", "Fluent", "Native"];
const AVAIL_STATUS  = ["Available", "Open to Opportunities", "Not Available"];
const AVAIL_TYPES   = ["Full-time", "Part-time", "Contract"];
const EDU_LEVELS    = ["None","High School","Associate","Bachelor","Master","PhD"];

export default function CandidateDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { toast }  = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState(null);

  const [skillInput,   setSkillInput]   = useState({ name: "", level: "Intermediate", yearsOfExperience: 1 });
  const [langInput,    setLangInput]    = useState({ name: "", proficiency: "Fluent" });
  const [projectInput, setProjectInput] = useState({ name: "", description: "", technologies: "", role: "", link: "" });
  const [expInput,     setExpInput]     = useState({ company: "", role: "", "Start Date": "", "End Date": "", description: "", technologies: "", "Is Current": false });
  const [eduInput,     setEduInput]     = useState({ institution: "", degree: "Bachelor's", "Field of Study": "", "Start Year": "", "End Year": "" });
  const [certInput,    setCertInput]    = useState({ name: "", issuer: "", "Issue Date": "" });

  useEffect(() => {
    applicantsApi.get(id)
      .then(data => setForm(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Skills ────────────────────────────────────────────────────────
  const addSkill = () => {
    if (!skillInput.name.trim()) return;
    const raw = form.skills || [];
    const normalized = raw.map(s => typeof s === "string" ? { name: s, level: "Intermediate", yearsOfExperience: 0 } : s);
    if (!normalized.find(s => s.name.toLowerCase() === skillInput.name.trim().toLowerCase())) {
      update("skills", [...normalized, { ...skillInput, name: skillInput.name.trim() }]);
    }
    setSkillInput({ name: "", level: "Intermediate", yearsOfExperience: 1 });
  };
  const removeSkill = (name) => update("skills", (form.skills || []).filter(s => (typeof s === "string" ? s : s.name) !== name));

  // ── Languages ─────────────────────────────────────────────────────
  const addLang = () => {
    if (!langInput.name.trim()) return;
    const raw = form.languages || [];
    const normalized = raw.map(l => typeof l === "string" ? { name: l, proficiency: "Fluent" } : l);
    if (!normalized.find(l => l.name.toLowerCase() === langInput.name.trim().toLowerCase())) {
      update("languages", [...normalized, { ...langInput, name: langInput.name.trim() }]);
    }
    setLangInput({ name: "", proficiency: "Fluent" });
  };
  const removeLang = (name) => update("languages", (form.languages || []).filter(l => (typeof l === "string" ? l : l.name) !== name));

  // ── Projects ──────────────────────────────────────────────────────
  const addProject = () => {
    if (!projectInput.name.trim()) return;
    const techs = projectInput.technologies.split(",").map(t => t.trim()).filter(Boolean);
    update("projects", [...(form.projects || []), { ...projectInput, technologies: techs }]);
    setProjectInput({ name: "", description: "", technologies: "", role: "", link: "" });
  };
  const removeProject = (name) => update("projects", (form.projects || []).filter(p => p.name !== name));

  // ── Work Experience ───────────────────────────────────────────────
  const addExp = () => {
    if (!expInput.company.trim() || !expInput.role.trim()) return;
    const techs = typeof expInput.technologies === "string"
      ? expInput.technologies.split(",").map(t => t.trim()).filter(Boolean)
      : expInput.technologies;
    const entry = { ...expInput, technologies: techs };
    // Store in experience[] (Umurava field name)
    update("experience", [...(form.experience || form.work_history || []), entry]);
    setExpInput({ company: "", role: "", "Start Date": "", "End Date": "", description: "", technologies: "", "Is Current": false });
  };
  const removeExp = (idx) => update("experience", (form.experience || form.work_history || []).filter((_, i) => i !== idx));

  // ── Education ─────────────────────────────────────────────────────
  const addEdu = () => {
    if (!eduInput.institution.trim()) return;
    update("education", [...(form.education || []), { ...eduInput }]);
    setEduInput({ institution: "", degree: "Bachelor's", "Field of Study": "", "Start Year": "", "End Year": "" });
  };
  const removeEdu = (idx) => update("education", (form.education || []).filter((_, i) => i !== idx));

  // ── Certifications ────────────────────────────────────────────────
  const addCert = () => {
    if (!certInput.name.trim()) return;
    update("certifications", [...(form.certifications || []), { ...certInput }]);
    setCertInput({ name: "", issuer: "", "Issue Date": "" });
  };
  const removeCert = (idx) => update("certifications", (form.certifications || []).filter((_, i) => i !== idx));

  // ── Save ──────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      // Sync full_name from first_name + last_name if both provided
      const firstName = (form.first_name || "").trim();
      const lastName  = (form.last_name  || "").trim();
      const fullName  = firstName && lastName ? `${firstName} ${lastName}` : form.full_name;

      const coreFields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
      const filled = coreFields.filter(f => { const v = form[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });

      await applicantsApi.update(id, {
        ...form,
        full_name: fullName,
        profile_completeness: Math.round((filled.length / coreFields.length) * 100),
      });
      toast({ title: "Candidate updated" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!form) return <p className="text-center text-muted-foreground py-16">Candidate not found</p>;

  const normalizedSkills = (form.skills || []).map(s => typeof s === "string" ? { name: s, level: "Intermediate", yearsOfExperience: 0 } : s);
  const normalizedLangs  = (form.languages || []).map(l => typeof l === "string" ? { name: l, proficiency: "Fluent" } : l);
  const experience       = form.experience || form.work_history || [];
  const certifications   = form.certifications || [];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-heading font-bold">{form.full_name}</h1>
          {form.headline && <p className="text-sm text-muted-foreground">{form.headline}</p>}
        </div>
      </div>

      {/* ── Basic Info ─────────────────────────────────────── */}
      <Section icon={<Globe className="w-4 h-4" />} title="Basic Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name *">
            <Input value={form.first_name || ""} onChange={e => update("first_name", e.target.value)} className="mt-1" />
          </Field>
          <Field label="Last Name *">
            <Input value={form.last_name || ""} onChange={e => update("last_name", e.target.value)} className="mt-1" />
          </Field>
          <Field label="Email *">
            <Input value={form.email || ""} onChange={e => update("email", e.target.value)} className="mt-1" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone || ""} onChange={e => update("phone", e.target.value)} className="mt-1" />
          </Field>
          <Field label="Location * (City, Country)">
            <Input value={form.location || ""} onChange={e => update("location", e.target.value)} className="mt-1" placeholder="Kigali, Rwanda" />
          </Field>
          <Field label="Headline *">
            <Input value={form.headline || ""} onChange={e => update("headline", e.target.value)} className="mt-1" placeholder="Backend Engineer – Node.js & AI Systems" />
          </Field>
        </div>
        <Field label="Bio">
          <Textarea value={form.bio || ""} onChange={e => update("bio", e.target.value)} className="mt-1 min-h-[80px]" placeholder="Detailed professional biography..." />
        </Field>
      </Section>

      {/* ── Skills ─────────────────────────────────────────── */}
      <Section icon={<Code className="w-4 h-4" />} title="Skills">
        <div className="flex gap-2 flex-wrap">
          <Input value={skillInput.name} onChange={e => setSkillInput(p => ({ ...p, name: e.target.value }))}
            placeholder="Skill name..." className="flex-1 min-w-[140px]"
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())} />
          <Select value={skillInput.level} onValueChange={v => setSkillInput(p => ({ ...p, level: v }))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{SKILL_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" min="0" max="30" value={skillInput.yearsOfExperience}
            onChange={e => setSkillInput(p => ({ ...p, yearsOfExperience: Number(e.target.value) }))}
            className="w-20" placeholder="Yrs" />
          <Button type="button" variant="outline" size="icon" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {normalizedSkills.map(s => (
            <span key={s.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {s.name}
              <span className="text-primary/60">· {s.level}{s.yearsOfExperience ? ` · ${s.yearsOfExperience}yr` : ""}</span>
              <button onClick={() => removeSkill(s.name)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      </Section>

      {/* ── Languages ──────────────────────────────────────── */}
      <Section icon={<Globe className="w-4 h-4" />} title="Languages">
        <div className="flex gap-2">
          <Input value={langInput.name} onChange={e => setLangInput(p => ({ ...p, name: e.target.value }))}
            placeholder="Language..." className="flex-1"
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLang())} />
          <Select value={langInput.proficiency} onValueChange={v => setLangInput(p => ({ ...p, proficiency: v }))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{LANG_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={addLang}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {normalizedLangs.map(l => (
            <span key={l.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
              {l.name} · {l.proficiency}
              <button onClick={() => removeLang(l.name)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      </Section>

      {/* ── Work Experience ─────────────────────────────────── */}
      <Section icon={<Briefcase className="w-4 h-4" />} title="Work Experience">
        {/* Add experience form */}
        <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Add new entry</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={expInput.company} onChange={e => setExpInput(p => ({ ...p, company: e.target.value }))} placeholder="Company *" />
            <Input value={expInput.role} onChange={e => setExpInput(p => ({ ...p, role: e.target.value }))} placeholder="Role / Title *" />
            <Input value={expInput["Start Date"]} onChange={e => setExpInput(p => ({ ...p, "Start Date": e.target.value }))} placeholder="Start (YYYY-MM)" />
            <Input value={expInput["End Date"]} onChange={e => setExpInput(p => ({ ...p, "End Date": e.target.value }))} placeholder="End (YYYY-MM or Present)" disabled={expInput["Is Current"]} />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <input type="checkbox" id="is-current" checked={expInput["Is Current"]}
              onChange={e => setExpInput(p => ({ ...p, "Is Current": e.target.checked, "End Date": e.target.checked ? "Present" : "" }))} />
            <label htmlFor="is-current" className="text-muted-foreground cursor-pointer">Currently working here</label>
          </div>
          <Input value={expInput.technologies} onChange={e => setExpInput(p => ({ ...p, technologies: e.target.value }))} placeholder="Technologies used (comma-separated)" />
          <Textarea value={expInput.description} onChange={e => setExpInput(p => ({ ...p, description: e.target.value }))} placeholder="Key responsibilities and achievements..." className="min-h-[60px]" />
          <Button type="button" variant="outline" size="sm" onClick={addExp} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Experience</Button>
        </div>
        {/* Existing entries */}
        <div className="space-y-2">
          {experience.map((exp, i) => (
            <div key={i} className="rounded-lg border border-border p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-sm">{exp.role || exp.title} <span className="text-muted-foreground font-normal">at {exp.company}</span></p>
                <p className="text-xs text-muted-foreground">{exp["Start Date"] || exp.startDate} – {exp["End Date"] || exp.endDate || (exp["Is Current"] || exp.isCurrent ? "Present" : "")}</p>
                {exp.description && <p className="text-xs text-foreground/70">{exp.description}</p>}
                {(exp.technologies || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {exp.technologies.map(t => <span key={t} className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{t}</span>)}
                  </div>
                )}
              </div>
              <button onClick={() => removeExp(i)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Education ───────────────────────────────────────── */}
      <Section icon={<GraduationCap className="w-4 h-4" />} title="Education">
        {/* Quick fields for AI scoring */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-border mb-3">
          <Field label="Highest Education Level">
            <Select value={form.education_level || "None"} onValueChange={v => update("education_level", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{EDU_LEVELS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Primary Field of Study">
            <Input value={form.education_field || ""} onChange={e => update("education_field", e.target.value)} className="mt-1" placeholder="Computer Science" />
          </Field>
        </div>

        {/* Add education entry form */}
        <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Add education entry</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={eduInput.institution} onChange={e => setEduInput(p => ({ ...p, institution: e.target.value }))} placeholder="Institution *" />
            <Input value={eduInput.degree} onChange={e => setEduInput(p => ({ ...p, degree: e.target.value }))} placeholder="Degree (e.g. Bachelor's)" />
            <Input value={eduInput["Field of Study"]} onChange={e => setEduInput(p => ({ ...p, "Field of Study": e.target.value }))} placeholder="Field of Study" />
            <div className="flex gap-2">
              <Input value={eduInput["Start Year"]} onChange={e => setEduInput(p => ({ ...p, "Start Year": e.target.value }))} placeholder="Start year" className="w-1/2" />
              <Input value={eduInput["End Year"]} onChange={e => setEduInput(p => ({ ...p, "End Year": e.target.value }))} placeholder="End year" className="w-1/2" />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addEdu} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Education</Button>
        </div>
        {/* Existing entries */}
        <div className="space-y-2">
          {(form.education || []).map((edu, i) => (
            <div key={i} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{edu.degree} in {edu["Field of Study"] || edu.field}</p>
                <p className="text-xs text-muted-foreground">{edu.institution} · {edu["Start Year"]} – {edu["End Year"]}</p>
              </div>
              <button onClick={() => removeEdu(i)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Certifications ──────────────────────────────────── */}
      <Section icon={<Award className="w-4 h-4" />} title="Certifications">
        <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Add certification</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input value={certInput.name} onChange={e => setCertInput(p => ({ ...p, name: e.target.value }))} placeholder="Certification name *" />
            <Input value={certInput.issuer} onChange={e => setCertInput(p => ({ ...p, issuer: e.target.value }))} placeholder="Issuer (e.g. Amazon)" />
            <Input value={certInput["Issue Date"]} onChange={e => setCertInput(p => ({ ...p, "Issue Date": e.target.value }))} placeholder="Issue date (YYYY-MM)" />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCert} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Certification</Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {certifications.map((c, i) => {
            const label = typeof c === "string" ? c : `${c.name}${c.issuer ? ` · ${c.issuer}` : ""}`;
            return (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                {label}
                <button onClick={() => removeCert(i)}><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      </Section>

      {/* ── Projects ────────────────────────────────────────── */}
      <Section icon={<Code className="w-4 h-4" />} title="Projects">
        <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add project</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={projectInput.name} onChange={e => setProjectInput(p => ({ ...p, name: e.target.value }))} placeholder="Project name *" />
            <Input value={projectInput.role} onChange={e => setProjectInput(p => ({ ...p, role: e.target.value }))} placeholder="Your role" />
            <Input value={projectInput.technologies} onChange={e => setProjectInput(p => ({ ...p, technologies: e.target.value }))} placeholder="Technologies (comma-separated)" />
            <Input value={projectInput.link} onChange={e => setProjectInput(p => ({ ...p, link: e.target.value }))} placeholder="Link (https://...)" />
          </div>
          <Textarea value={projectInput.description} onChange={e => setProjectInput(p => ({ ...p, description: e.target.value }))} placeholder="Description..." className="min-h-[60px]" />
          <Button type="button" variant="outline" size="sm" onClick={addProject} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Project</Button>
        </div>
        <div className="space-y-2 mt-3">
          {(form.projects || []).map((p, i) => (
            <div key={i} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{p.name} {p.role && <span className="text-muted-foreground font-normal">· {p.role}</span>}</p>
                {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
                {(p.technologies || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">{p.technologies.map(t => <span key={t} className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{t}</span>)}</div>
                )}
              </div>
              <button onClick={() => removeProject(p.name)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Availability ────────────────────────────────────── */}
      <Section icon={<Briefcase className="w-4 h-4" />} title="Availability">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Status">
            <Select value={form.availability?.status || "Available"} onValueChange={v => update("availability", { ...(form.availability || {}), status: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{AVAIL_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.availability?.type || "Full-time"} onValueChange={v => update("availability", { ...(form.availability || {}), type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{AVAIL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      {/* ── Social Links ─────────────────────────────────────── */}
      <Section icon={<Globe className="w-4 h-4" />} title="Social Links">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="LinkedIn">
            <Input value={form.socialLinks?.linkedin || form.portfolio_url || ""} onChange={e => update("socialLinks", { ...(form.socialLinks || {}), linkedin: e.target.value })} className="mt-1" placeholder="https://linkedin.com/in/..." />
          </Field>
          <Field label="GitHub">
            <Input value={form.socialLinks?.github || ""} onChange={e => update("socialLinks", { ...(form.socialLinks || {}), github: e.target.value })} className="mt-1" placeholder="https://github.com/..." />
          </Field>
          <Field label="Portfolio">
            <Input value={form.socialLinks?.portfolio || ""} onChange={e => update("socialLinks", { ...(form.socialLinks || {}), portfolio: e.target.value })} className="mt-1" placeholder="https://..." />
          </Field>
        </div>
      </Section>

      <Button onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90 gap-2">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
      </Button>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <h2 className="font-heading font-semibold text-sm flex items-center gap-2 text-foreground">
        {icon}{title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
