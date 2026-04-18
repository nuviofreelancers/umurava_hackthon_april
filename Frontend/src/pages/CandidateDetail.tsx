import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { fetchApplicants } from "@/store/applicantsSlice";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, X, Save, Loader2, Briefcase,
  GraduationCap, Code, Globe, Award, User, Trash2, CalendarPlus
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ScheduleInterviewModal from "@/components/ScheduleInterviewModal";

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const LANG_LEVELS  = ["Basic", "Conversational", "Fluent", "Native"];
const AVAIL_STATUS = ["Available", "Open to Opportunities", "Not Available"];
const AVAIL_TYPES  = ["Full-time", "Part-time", "Contract"];
const EDU_LEVELS   = ["None", "High School", "Associate", "Bachelor", "Master", "PhD"];

// ─── Sidebar candidate list ───────────────────────────────────────────────────
function CandidateSidebar({ candidates, selectedId, onSelect }) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Candidates</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {candidates.map(c => {
          const isActive = c.id === selectedId;
          return (
            <Link
              key={c.id}
              to={`/candidates/${c.id}`}
              onClick={() => onSelect(c.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {(c.full_name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.full_name}</p>
                {c.current_role && (
                  <p className="text-[10px] text-muted-foreground truncate">{c.current_role}</p>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// ─── Main detail panel ────────────────────────────────────────────────────────
export default function CandidateDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const { toast } = useToast();

  const allCandidates = useSelector(s => s.applicants.list);
  const jobs          = useSelector(s => s.jobs?.list || []);

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(null);
  const [scheduling, setScheduling] = useState(false);

  const [skillInput,   setSkillInput]   = useState({ name: "", level: "Intermediate", yearsOfExperience: 1 });
  const [langInput,    setLangInput]    = useState({ name: "", proficiency: "Fluent" });
  const [projectInput, setProjectInput] = useState({ name: "", description: "", technologies: "", role: "", link: "" });
  const [expInput,     setExpInput]     = useState({ company: "", role: "", "Start Date": "", "End Date": "", description: "", technologies: "", "Is Current": false });
  const [eduInput,     setEduInput]     = useState({ institution: "", degree: "Bachelor's", "Field of Study": "", "Start Year": "", "End Year": "" });
  const [certInput,    setCertInput]    = useState({ name: "", issuer: "", "Issue Date": "" });

  const loadCandidate = useCallback(() => {
    setLoading(true);
    applicantsApi.get(id)
      .then(data => setForm(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadCandidate();
    if (allCandidates.length === 0) dispatch(fetchApplicants());
  }, [loadCandidate]);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addSkill = () => {
    if (!skillInput.name.trim()) return;
    const normalized = (form.skills || []).map(s => typeof s === "string" ? { name: s, level: "Intermediate", yearsOfExperience: 0 } : s);
    if (!normalized.find(s => s.name.toLowerCase() === skillInput.name.trim().toLowerCase())) {
      update("skills", [...normalized, { ...skillInput, name: skillInput.name.trim() }]);
    }
    setSkillInput({ name: "", level: "Intermediate", yearsOfExperience: 1 });
  };
  const removeSkill = (name) => update("skills", (form.skills || []).filter(s => (typeof s === "string" ? s : s.name) !== name));

  const addLang = () => {
    if (!langInput.name.trim()) return;
    const normalized = (form.languages || []).map(l => typeof l === "string" ? { name: l, proficiency: "Fluent" } : l);
    if (!normalized.find(l => l.name.toLowerCase() === langInput.name.trim().toLowerCase())) {
      update("languages", [...normalized, { ...langInput, name: langInput.name.trim() }]);
    }
    setLangInput({ name: "", proficiency: "Fluent" });
  };
  const removeLang = (name) => update("languages", (form.languages || []).filter(l => (typeof l === "string" ? l : l.name) !== name));

  const addProject = () => {
    if (!projectInput.name.trim()) return;
    const techs = projectInput.technologies.split(",").map(t => t.trim()).filter(Boolean);
    update("projects", [...(form.projects || []), { ...projectInput, technologies: techs }]);
    setProjectInput({ name: "", description: "", technologies: "", role: "", link: "" });
  };
  const removeProject = (name) => update("projects", (form.projects || []).filter(p => p.name !== name));

  const addExp = () => {
    if (!expInput.company.trim() || !expInput.role.trim()) return;
    const techs = typeof expInput.technologies === "string"
      ? expInput.technologies.split(",").map(t => t.trim()).filter(Boolean)
      : expInput.technologies;
    update("experience", [...(form.experience || form.work_history || []), { ...expInput, technologies: techs }]);
    setExpInput({ company: "", role: "", "Start Date": "", "End Date": "", description: "", technologies: "", "Is Current": false });
  };
  const removeExp = (idx) => update("experience", (form.experience || form.work_history || []).filter((_, i) => i !== idx));

  const addEdu = () => {
    if (!eduInput.institution.trim()) return;
    update("education", [...(form.education || []), { ...eduInput }]);
    setEduInput({ institution: "", degree: "Bachelor's", "Field of Study": "", "Start Year": "", "End Year": "" });
  };
  const removeEdu = (idx) => update("education", (form.education || []).filter((_, i) => i !== idx));

  const addCert = () => {
    if (!certInput.name.trim()) return;
    update("certifications", [...(form.certifications || []), { ...certInput }]);
    setCertInput({ name: "", issuer: "", "Issue Date": "" });
  };
  const removeCert = (idx) => update("certifications", (form.certifications || []).filter((_, i) => i !== idx));

  const save = async () => {
    setSaving(true);
    try {
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

  const jobTitle = form ? (jobs.find(j => j.id === form.job_id)?.title || "Unknown Job") : "";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!form) return <p className="text-center text-muted-foreground py-16">Candidate not found</p>;

  const normalizedSkills = (form.skills || []).map(s => typeof s === "string" ? { name: s, level: "Intermediate", yearsOfExperience: 0 } : s);
  const normalizedLangs  = (form.languages || []).map(l => typeof l === "string" ? { name: l, proficiency: "Fluent" } : l);
  const experience       = form.experience || form.work_history || [];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Candidate Profile</h1>
            <p className="text-muted-foreground text-sm mt-0.5">View and edit candidate information</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setScheduling(true)}
          >
            <CalendarPlus className="w-4 h-4" /> Schedule Interview
          </Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 gap-5 min-h-0">
        {/* Sidebar */}
        {allCandidates.length > 0 && (
          <CandidateSidebar
            candidates={allCandidates}
            selectedId={id}
            onSelect={() => {}}
          />
        )}

        {/* Main scrollable panel */}
        <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden min-w-0">
          {/* Card header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-border shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-base shrink-0">
              {(form.full_name || "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-semibold text-base truncate">{form.full_name}</h2>
              {form.current_role && (
                <p className="text-xs text-muted-foreground">{form.current_role}{form.current_company && ` at ${form.current_company}`}</p>
              )}
            </div>
            {form.interview_status && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                {form.interview_status}
              </span>
            )}
          </div>

          {/* Scrollable fields */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Basic Info */}
            <Section icon={<User className="w-4 h-4" />} title="Basic Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="First Name">
                  <Input value={form.first_name || ""} onChange={e => update("first_name", e.target.value)} className="mt-1" />
                </Field>
                <Field label="Last Name">
                  <Input value={form.last_name || ""} onChange={e => update("last_name", e.target.value)} className="mt-1" />
                </Field>
                <Field label="Email">
                  <Input value={form.email || ""} onChange={e => update("email", e.target.value)} className="mt-1" />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone || ""} onChange={e => update("phone", e.target.value)} className="mt-1" />
                </Field>
                <Field label="Location">
                  <Input value={form.location || ""} onChange={e => update("location", e.target.value)} className="mt-1" placeholder="Kigali, Rwanda" />
                </Field>
                <Field label="Headline">
                  <Input value={form.headline || ""} onChange={e => update("headline", e.target.value)} className="mt-1" placeholder="Backend Engineer – Node.js" />
                </Field>
                <Field label="Current Role">
                  <Input value={form.current_role || ""} onChange={e => update("current_role", e.target.value)} className="mt-1" />
                </Field>
                <Field label="Current Company">
                  <Input value={form.current_company || ""} onChange={e => update("current_company", e.target.value)} className="mt-1" />
                </Field>
                <Field label="Experience (years)">
                  <Input type="number" value={form.experience_years ?? ""} onChange={e => update("experience_years", Number(e.target.value))} className="mt-1" />
                </Field>
                <Field label="Portfolio / LinkedIn">
                  <Input value={form.portfolio_url || ""} onChange={e => update("portfolio_url", e.target.value)} className="mt-1" placeholder="https://..." />
                </Field>
              </div>
              <Field label="Bio">
                <Textarea value={form.bio || ""} onChange={e => update("bio", e.target.value)} className="mt-1 min-h-[80px]" placeholder="Professional biography..." />
              </Field>
            </Section>

            {/* Skills */}
            <Section icon={<Code className="w-4 h-4" />} title="Skills">
              <div className="flex gap-2 flex-wrap">
                <Input value={skillInput.name} onChange={e => setSkillInput(p => ({ ...p, name: e.target.value }))}
                  placeholder="Skill name..." className="flex-1 min-w-[120px]"
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())} />
                <Select value={skillInput.level} onValueChange={v => setSkillInput(p => ({ ...p, level: v }))}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{SKILL_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min="0" max="30" value={skillInput.yearsOfExperience}
                  onChange={e => setSkillInput(p => ({ ...p, yearsOfExperience: Number(e.target.value) }))}
                  className="w-16" placeholder="Yrs" />
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

            {/* Languages */}
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

            {/* Work Experience */}
            <Section icon={<Briefcase className="w-4 h-4" />} title="Work Experience">
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
                <Input value={expInput.technologies} onChange={e => setExpInput(p => ({ ...p, technologies: e.target.value }))} placeholder="Technologies (comma-separated)" />
                <Textarea value={expInput.description} onChange={e => setExpInput(p => ({ ...p, description: e.target.value }))} placeholder="Key responsibilities..." className="min-h-[60px]" />
                <Button type="button" variant="outline" size="sm" onClick={addExp} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add</Button>
              </div>
              <div className="space-y-2 mt-2">
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

            {/* Education */}
            <Section icon={<GraduationCap className="w-4 h-4" />} title="Education">
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
              <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Add education entry</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input value={eduInput.institution} onChange={e => setEduInput(p => ({ ...p, institution: e.target.value }))} placeholder="Institution *" />
                  <Input value={eduInput.degree} onChange={e => setEduInput(p => ({ ...p, degree: e.target.value }))} placeholder="Degree" />
                  <Input value={eduInput["Field of Study"]} onChange={e => setEduInput(p => ({ ...p, "Field of Study": e.target.value }))} placeholder="Field of Study" />
                  <div className="flex gap-2">
                    <Input value={eduInput["Start Year"]} onChange={e => setEduInput(p => ({ ...p, "Start Year": e.target.value }))} placeholder="Start" className="w-1/2" />
                    <Input value={eduInput["End Year"]} onChange={e => setEduInput(p => ({ ...p, "End Year": e.target.value }))} placeholder="End" className="w-1/2" />
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addEdu} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add</Button>
              </div>
              <div className="space-y-2 mt-2">
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

            {/* Certifications */}
            <Section icon={<Award className="w-4 h-4" />} title="Certifications">
              <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input value={certInput.name} onChange={e => setCertInput(p => ({ ...p, name: e.target.value }))} placeholder="Certification *" />
                  <Input value={certInput.issuer} onChange={e => setCertInput(p => ({ ...p, issuer: e.target.value }))} placeholder="Issuer" />
                  <Input value={certInput["Issue Date"]} onChange={e => setCertInput(p => ({ ...p, "Issue Date": e.target.value }))} placeholder="YYYY-MM" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCert} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(form.certifications || []).map((c, i) => {
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

            {/* Availability */}
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

          </div>
        </div>
      </div>

      {/* Schedule interview modal */}
      {scheduling && (
        <ScheduleInterviewModal
          applicant={form}
          jobTitle={jobTitle}
          onClose={() => setScheduling(false)}
          onScheduled={() => { setScheduling(false); loadCandidate(); }}
        />
      )}
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="rounded-xl border border-border p-5 space-y-4">
      <h2 className="font-heading font-semibold text-sm flex items-center gap-2">{icon}{title}</h2>
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
