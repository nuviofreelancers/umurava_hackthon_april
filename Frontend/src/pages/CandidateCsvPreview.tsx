import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trash2, Loader2, CheckCircle, User, AlertCircle, X, Plus, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EDU_LEVELS   = ["None", "High School", "Associate", "Bachelor", "Master", "PhD"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

function calculateCompleteness(c) {
  const fields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
  const filled = fields.filter(f => { const v = c[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });
  return Math.round((filled.length / fields.length) * 100);
}

const normSkills = (skills = []) =>
  skills.map(s => typeof s === "string" ? { name: s, level: "Intermediate" } : s);

// ── Editable candidate card ────────────────────────────────────────────────────
function CandidateEditor({ candidate, onChange, onRemove }) {
  const [skillInput, setSkillInput] = useState({ name: "", level: "Intermediate" });

  const update = (field, value) => onChange({ ...candidate, [field]: value });

  const addSkill = () => {
    const name = skillInput.name.trim();
    if (!name) return;
    const current = candidate.skills || [];
    if (!current.find(s => s.name?.toLowerCase() === name.toLowerCase())) {
      update("skills", [...current, { name, level: skillInput.level }]);
    }
    setSkillInput({ name: "", level: "Intermediate" });
  };

  const removeSkill = (name) =>
    update("skills", candidate.skills.filter(s => s.name !== name));

  return (
    <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden min-w-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="font-heading font-semibold text-base">
            {candidate.full_name?.trim() || <span className="text-muted-foreground italic">No name</span>}
          </h2>
          {candidate._nonStandard && candidate._missingFields?.length > 0 && (
            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Missing: {candidate._missingFields.join(", ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Remove this candidate"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

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
                  <button type="button" onClick={() => removeSkill(s.name)} className="hover:text-destructive transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {(candidate.skills || []).length === 0 && (
                <p className="text-xs text-muted-foreground italic">No skills added yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Candidate sidebar — FIX: outer row is now a <div role="button"> so the
// inner trash <button> is not nested inside another <button>
function CandidateSidebar({ candidates, selected, onSelect, onRemove, showWarnings = false }) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Candidates</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {candidates.map((c, idx) => {
          const isValid  = !!(c.full_name?.trim() && c.email?.trim());
          const isActive = idx === selected;
          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(idx)}
              onKeyDown={e => e.key === "Enter" && onSelect(idx)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors group cursor-pointer ${
                isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
            >
              {showWarnings
                ? <AlertTriangle className={`w-4 h-4 shrink-0 ${isActive ? "text-amber-500" : "text-amber-400"}`} />
                : isValid
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
                {showWarnings && c._missingFields?.length > 0 && (
                  <p className="text-[10px] text-amber-500 truncate">Missing {c._missingFields.length} field{c._missingFields.length > 1 ? "s" : ""}</p>
                )}
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onRemove(idx); }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        {candidates.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6 italic">No candidates here</p>
        )}
      </nav>
    </aside>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CandidateCsvPreview() {
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [allCandidates, setAllCandidates] = useState([]);
  const [selectedValid,  setSelectedValid]  = useState(0);
  const [selectedIssue,  setSelectedIssue]  = useState(0);
  const [saving,   setSaving]   = useState(false);
  const [activeTab, setActiveTab] = useState("valid");
  const [returnJobId, setReturnJobId] = useState<string | null>(null);
  // Prevents the "no candidates" redirect firing after a successful save
  // empties allCandidates before navigation completes
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("csv_candidates_preview");
      if (raw) {
        const parsed = JSON.parse(raw);
        const tagged = parsed.map(c => ({ ...c, skills: normSkills(c.skills) }));
        setAllCandidates(tagged);
        // Check both key names — ApplicantUpload now sends jobId, old data may have job_id
        const firstJobId = tagged[0]?.jobId || tagged[0]?.job_id || null;
        setReturnJobId(firstJobId);
      } else {
        navigate("/candidates");
      }
    } catch {
      navigate("/candidates");
    } finally {
      setLoaded(true);
    }
  }, []);

  const handleCancel = () => {
    sessionStorage.removeItem("csv_candidates_preview");
    navigate(returnJobId ? `/jobs/${returnJobId}` : "/candidates");
  };

  // Don't render anything until sessionStorage has been read
  if (!loaded) return null;

  if (allCandidates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No candidates to preview.
      </div>
    );
  }

  const validCandidates = allCandidates.filter(c => !c._nonStandard);
  const issueCandidates = allCandidates.filter(c => c._nonStandard);

  const updateCandidate = (c, idx, list, isIssue = false) => {
    const required = ["full_name", "email", "current_role", "skills"];
    const missingNow = required.filter(f => {
      const v = c[f];
      return !v || (Array.isArray(v) ? v.length === 0 : v.toString().trim() === "");
    });
    const updated = { ...c, _nonStandard: missingNow.length > 0, _missingFields: missingNow };

    setAllCandidates(prev => {
      const all = [...prev];
      let count = -1;
      for (let i = 0; i < all.length; i++) {
        if (!!all[i]._nonStandard === isIssue) { count++; if (count === idx) { all[i] = updated; break; } }
      }
      return all;
    });
  };

  const removeCandidate = (idx, isIssue = false) => {
    setAllCandidates(prev => {
      let count = -1;
      return prev.filter((c) => {
        if (!!c._nonStandard === isIssue) { count++; return count !== idx; }
        return true;
      });
    });
    if (isIssue) setSelectedIssue(i => Math.max(0, i - 1));
    else setSelectedValid(i => Math.max(0, i - 1));
  };

  const handleImport = async (includeIssues = false) => {
    const toImport = includeIssues
      ? allCandidates.filter(c => c.full_name?.trim() && c.email?.trim())
      : validCandidates.filter(c => c.full_name?.trim() && c.email?.trim());

    if (toImport.length === 0) {
      toast({ title: "No valid candidates", description: "Each candidate needs at least a name and email.", variant: "destructive", duration: 3000 });
      return;
    }
    setSaving(true);
    try {
      // Check both key names — jobId is set by ApplicantUpload, job_id may exist in older data
      const jobId      = (toImport[0] as any).jobId || (toImport[0] as any).job_id;
      const sourceType = (toImport[0] as any).sourceType || "csv";
      const docs = toImport.map(c => {
        const { job_id: _jid, jobId: _ji, sourceType: _st, _nonStandard: _ns, _missingFields: _mf, _missingRecommended: _mr, ...rest } = c as any;
        // Pass jobId explicitly on each doc so bulkCreate stores it correctly
        return { ...rest, jobId: jobId || undefined, profile_completeness: calculateCompleteness(c) };
      });

      const response = await applicantsApi.bulkCreate(docs, jobId, sourceType) as any;

      // FIX: surface duplicate/cross-job warnings from backend
      const dupWarnings: string[] = response?.duplicateWarnings || [];
      const crossJobs:   string[] = response?.crossJobMatches   || [];

      sessionStorage.removeItem("csv_candidates_preview");

      const imported = response?.inserted?.length ?? toImport.length;
      // FIX: auto-dismiss after 3 seconds
      toast({ title: `${imported} candidate${imported !== 1 ? "s" : ""} imported`, duration: 3000 });

      if (dupWarnings.length > 0) {
        toast({
          title: "Already applied to this job",
          description: `${dupWarnings.join(", ")} ${dupWarnings.length === 1 ? "is" : "are"} already in this job.`,
          variant: "destructive",
          duration: 5000,
        });
      }
      if (crossJobs.length > 0) {
        toast({
          title: "Candidates found in another job",
          description: `${crossJobs.join(", ")} previously applied to a different job.`,
          duration: 5000,
        });
      }

      navigate(jobId ? `/jobs/${jobId}` : "/candidates");
    } catch {
      toast({ title: "Import failed", description: "Please try again.", variant: "destructive", duration: 3000 });
    }
    setSaving(false);
  };

  const validCount = validCandidates.filter(c => c.full_name?.trim() && c.email?.trim()).length;
  const issueCount = issueCandidates.length;

  const currentValid = validCandidates[selectedValid];
  const currentIssue = issueCandidates[selectedIssue];

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Preview Imported Candidates</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {validCount} ready to import
              {issueCount > 0 && <span className="text-amber-500 ml-1">· {issueCount} need review</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          {issueCount > 0 && (
            <Button variant="outline" onClick={() => handleImport(true)} disabled={saving}
              className="border-amber-300 text-amber-700 hover:bg-amber-50">
              Import All ({validCount + issueCount})
            </Button>
          )}
          <Button onClick={() => handleImport(false)} disabled={saving || validCount === 0}
            className="bg-primary hover:bg-primary/90 gap-2">
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
              : <><CheckCircle className="w-4 h-4" /> Import {validCount} Valid</>
            }
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col" style={{height: "calc(100vh - 16rem)"}}>
        <TabsList className="shrink-0 self-start mb-4">
          <TabsTrigger value="valid" className="gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Valid
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
              {validCandidates.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="issues" className="gap-1.5" disabled={issueCount === 0}>
            <AlertTriangle className="w-3.5 h-3.5" />
            Needs Review
            {issueCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {issueCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="valid" className="flex gap-5 mt-0 overflow-hidden" style={{height: "calc(100% - 2.5rem)"}}>
          {validCandidates.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              No valid candidates — fix issues in the "Needs Review" tab first.
            </div>
          ) : (
            <>
              <CandidateSidebar candidates={validCandidates} selected={selectedValid}
                onSelect={i => setSelectedValid(i)} onRemove={i => removeCandidate(i, false)} />
              {currentValid && (
                <CandidateEditor candidate={currentValid}
                  onChange={c => updateCandidate(c, selectedValid, validCandidates, false)}
                  onRemove={() => removeCandidate(selectedValid, false)} />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="issues" className="flex gap-5 mt-0 overflow-hidden" style={{height: "calc(100% - 2.5rem)"}}>
          {issueCandidates.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              No issues — all candidates look good.
            </div>
          ) : (
            <>
              <CandidateSidebar candidates={issueCandidates} selected={selectedIssue}
                onSelect={i => setSelectedIssue(i)} onRemove={i => removeCandidate(i, true)} showWarnings />
              {currentIssue && (
                <div className="flex flex-col flex-1 gap-3 min-h-0">
                  <div className="shrink-0 flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold mb-0.5">This resume is missing required fields</p>
                      <p><span className="font-medium">Required: </span>{currentIssue._missingFields?.join(", ") || "—"}</p>
                      {currentIssue._missingRecommended?.length > 0 && (
                        <p className="mt-0.5 text-amber-600">
                          <span className="font-medium">Also recommended: </span>
                          {currentIssue._missingRecommended.join(", ")}
                        </p>
                      )}
                      <p className="mt-1 text-amber-600">Fill in the fields below or remove this candidate from the import.</p>
                    </div>
                  </div>
                  <CandidateEditor candidate={currentIssue}
                    onChange={c => updateCandidate(c, selectedIssue, issueCandidates, true)}
                    onRemove={() => removeCandidate(selectedIssue, true)} />
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
