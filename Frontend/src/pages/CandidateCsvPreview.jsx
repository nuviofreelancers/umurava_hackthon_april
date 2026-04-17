import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Loader2, CheckCircle, User, AlertCircle, X, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EDU_LEVELS   = ["None", "High School", "Associate", "Bachelor", "Master", "PhD"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

function calculateCompleteness(c) {
  const fields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
  const filled = fields.filter(f => { const v = c[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });
  return Math.round((filled.length / fields.length) * 100);
}

// Normalise skills to {name, level} objects regardless of how they came in
const normSkills = (skills = []) =>
  skills.map(s => typeof s === "string" ? { name: s, level: "Intermediate" } : s);

export default function CandidateCsvPreview() {
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [candidates, setCandidates] = useState([]);
  const [selected,   setSelected]   = useState(0);
  const [saving,     setSaving]     = useState(false);
  const [dirty,      setDirty]      = useState(false);
  const [skillInput, setSkillInput] = useState({ name: "", level: "Intermediate" });

  // ── Load from sessionStorage (written by ApplicantUpload) ──────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("csv_candidates_preview");
      if (raw) {
        const parsed = JSON.parse(raw);
        // Normalise skills on each candidate
        setCandidates(parsed.map(c => ({ ...c, skills: normSkills(c.skills) })));
      } else {
        navigate(-1);
      }
    } catch {
      navigate(-1);
    }
  }, []);

  if (candidates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No candidates to preview.
      </div>
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const update = (field, value) => {
    setCandidates(prev => prev.map((c, i) => i === selected ? { ...c, [field]: value } : c));
    setDirty(true);
  };

  const removeCandidate = (idx) => {
    const updated = candidates.filter((_, i) => i !== idx);
    setCandidates(updated);
    setSelected(Math.min(selected, updated.length - 1));
    setDirty(false);
  };

  const addSkill = () => {
    const name = skillInput.name.trim();
    if (!name) return;
    const current = candidate.skills || [];
    if (!current.find(s => s.name.toLowerCase() === name.toLowerCase())) {
      update("skills", [...current, { name, level: skillInput.level }]);
    }
    setSkillInput({ name: "", level: "Intermediate" });
  };

  const removeSkill = (name) => {
    update("skills", candidate.skills.filter(s => s.name !== name));
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    const valid = candidates.filter(c => c.full_name?.trim() && c.email?.trim());
    if (valid.length === 0) {
      toast({ title: "No valid candidates", description: "Each candidate needs at least a name and email.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await applicantsApi.bulkCreate(
        valid.map(c => ({
          ...c,
          source: "CSV Upload",
          profile_completeness: calculateCompleteness(c),
        }))
      );
      sessionStorage.removeItem("csv_candidates_preview");
      toast({ title: `${valid.length} candidate${valid.length > 1 ? "s" : ""} imported` });
      navigate("/candidates");
    } catch {
      toast({ title: "Import failed", description: "Please try again.", variant: "destructive" });
    }
    setSaving(false);
  };

  const candidate  = candidates[selected];
  const validCount = candidates.filter(c => c.full_name?.trim() && c.email?.trim()).length;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Preview Imported Candidates</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {validCount} of {candidates.length} valid — review and edit before importing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={saving || validCount === 0}
            className="bg-primary hover:bg-primary/90 gap-2"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
              : <><CheckCircle className="w-4 h-4" /> Import {validCount} Candidate{validCount !== 1 ? "s" : ""}</>
            }
          </Button>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-5 min-h-0">

        {/* Sidebar */}
        <aside className="w-64 shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Candidates</p>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {candidates.map((c, idx) => {
              const isValid  = !!(c.full_name?.trim() && c.email?.trim());
              const isActive = idx === selected;
              return (
                <button
                  key={idx}
                  onClick={() => { setSelected(idx); setDirty(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors group ${
                    isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                  }`}
                >
                  {isValid
                    ? <User className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    : <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.full_name?.trim() || <span className="italic text-muted-foreground">No name</span>}
                    </p>
                    {c.current_role && (
                      <p className="text-[10px] text-muted-foreground truncate">{c.current_role}</p>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeCandidate(idx); }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main card panel */}
        <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden min-w-0">

          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="font-heading font-semibold text-base">
                {candidate.full_name?.trim() || <span className="text-muted-foreground italic">No name</span>}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Candidate {selected + 1} of {candidates.length}
              </p>
            </div>
            <button
              onClick={() => removeCandidate(selected)}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Remove this candidate"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable fields */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">

              <div>
                <Label className="text-xs">Full Name *</Label>
                <Input value={candidate.full_name ?? ""} onChange={e => update("full_name", e.target.value)} className="mt-1" placeholder="Jane Doe" />
              </div>

              <div>
                <Label className="text-xs">Email *</Label>
                <Input value={candidate.email ?? ""} onChange={e => update("email", e.target.value)} className="mt-1" placeholder="jane@example.com" />
              </div>

              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={candidate.phone ?? ""} onChange={e => update("phone", e.target.value)} className="mt-1" placeholder="+250 ..." />
              </div>

              <div>
                <Label className="text-xs">Location</Label>
                <Input value={candidate.location ?? ""} onChange={e => update("location", e.target.value)} className="mt-1" placeholder="Kigali, Rwanda" />
              </div>

              <div>
                <Label className="text-xs">Current Role</Label>
                <Input value={candidate.current_role ?? ""} onChange={e => update("current_role", e.target.value)} className="mt-1" placeholder="Software Engineer" />
              </div>

              <div>
                <Label className="text-xs">Current Company</Label>
                <Input value={candidate.current_company ?? ""} onChange={e => update("current_company", e.target.value)} className="mt-1" placeholder="Acme Corp" />
              </div>

              <div>
                <Label className="text-xs">Experience (years)</Label>
                <Input
                  type="number" min="0"
                  value={candidate.experience_years ?? ""}
                  onChange={e => update("experience_years", Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Education Level</Label>
                <Select value={candidate.education_level || "None"} onValueChange={v => update("education_level", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{EDU_LEVELS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Education Field</Label>
                <Input value={candidate.education_field ?? ""} onChange={e => update("education_field", e.target.value)} className="mt-1" placeholder="Computer Science" />
              </div>

              <div>
                <Label className="text-xs">Portfolio / LinkedIn</Label>
                <Input value={candidate.portfolio_url ?? ""} onChange={e => update("portfolio_url", e.target.value)} className="mt-1" placeholder="https://..." />
              </div>

              {/* Skills — full width */}
              <div className="sm:col-span-2">
                <Label className="text-xs">Skills</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={skillInput.name}
                    onChange={e => setSkillInput(p => ({ ...p, name: e.target.value }))}
                    placeholder="Skill name..."
                    className="flex-1"
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  />
                  <Select value={skillInput.level} onValueChange={v => setSkillInput(p => ({ ...p, level: v }))}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{SKILL_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={addSkill}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(candidate.skills || []).map(s => (
                    <span key={s.name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[11px] font-medium">
                      {s.name} · {s.level}
                      <button onClick={() => removeSkill(s.name)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {(candidate.skills || []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No skills added yet</p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Unsaved changes footer */}
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
