import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchApplicants, deleteApplicant, restoreApplicant } from "@/store/applicantsSlice";
import { fetchJobs } from "@/store/jobSlice";
import { fetchResults } from "@/store/resultsSlice";
import { User, Search, Briefcase, MapPin, GraduationCap, Trash2, CalendarPlus, UserPlus, Download } from "lucide-react";
import AddCandidateModal from "../components/AddCandidateModal";
import ScheduleInterviewModal from "../components/ScheduleInterviewModal";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import EmptyState from "../components/EmptyState";
import jsPDF from "jspdf";

// Helper: get the display name of a skill regardless of format
const skillName = (s) => typeof s === "string" ? s : (s?.name ?? "");

export default function Candidates() {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const applicants = useSelector(s => s.applicants.list);
  const jobs       = useSelector(s => s.jobs.list);
  const results    = useSelector(s => s.results.list);
  const loading    = useSelector(s => s.applicants.loading);
  const hasMore    = useSelector(s => (s.applicants as any).hasMore);
  const page       = useSelector(s => (s.applicants as any).page);

  const [search, setSearch]               = useState("");
  const [sourceFilter, setSourceFilter]   = useState("all");
  const [scheduling, setScheduling]       = useState(null);
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [loadingMore, setLoadingMore]     = useState(false);
  const { toast } = useToast();
  const undoRef = useRef(null);

  const loadAll = () => {
    dispatch(fetchApplicants());
    dispatch(fetchJobs());
    dispatch(fetchResults());
  };

  useEffect(() => { loadAll(); }, [dispatch]);

  // FIX: load next page and append to the list
  const handleLoadMore = async () => {
    setLoadingMore(true);
    await dispatch(fetchApplicants({ page: page + 1 }) as any);
    setLoadingMore(false);
  };

  // Collect unique user-defined source labels for the filter bar
  const allSources = Array.from(new Set(
    applicants.map(a => (a as any).source || (a as any).sourceType || "manual").filter(Boolean)
  ));
  const showSourceFilter = allSources.length > 0; // Always show when there are candidates

  const filtered = applicants.filter(a => {
    const q = search.toLowerCase();
    const matchesSearch = !search || (
      a.full_name?.toLowerCase().includes(q) ||
      (a.skills || []).some(s => skillName(s).toLowerCase().includes(q))
    );
    const matchesSource = sourceFilter === "all" ||
      ((a as any).source || (a as any).sourceType || "manual") === sourceFilter;
    return matchesSearch && matchesSource;
  });

  // FIX: check both .id and ._id on job objects since Mongoose virtuals
  // may or may not be serialised by Redux depending on the response shape
  const getJobTitle = (jobId) => {
    if (!jobId) return null;
    const jobIdStr = String(jobId);
    const found = jobs.find(j =>
      String(j.id) === jobIdStr ||
      String((j as any)._id) === jobIdStr
    );
    return found?.title || null;
  };

  const getResult = (applicantId) => results.find(r =>
    String((r as any).applicant_id) === String(applicantId)
  );

  const exportCSV = () => {
    const headers = ["Name","Email","Phone","Location","Current Role","Company","Experience (yrs)","Education","Skills","Source","Interview Status"];
    const rows = filtered.map(a => [
      a.full_name||"", a.email||"", a.phone||"", a.location||"",
      a.current_role||"", a.current_company||"", a.experience_years??"",
      a.education_level||"", (a.skills||[]).map(skillName).join("; "), a.source||"", a.interview_status||"",
    ]);
    const csv = [headers,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const el   = document.createElement("a"); el.href=url; el.download="candidates.csv"; el.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({orientation:"landscape"});
    doc.setFontSize(16); doc.text("Candidates List",14,16);
    doc.setFontSize(9);
    const headers   = ["Name","Role","Location","Education","Exp","Skills","Interview Status"];
    const colWidths = [40,40,30,25,15,70,45];
    let x=14, y=26;
    doc.setFont(undefined,"bold");
    headers.forEach((h,i)=>{ doc.text(h,x,y); x+=colWidths[i]; });
    doc.setFont(undefined,"normal"); y+=6;
    filtered.forEach(a=>{
      if(y>190){ doc.addPage(); y=20; }
      x=14;
      const row=[
        a.full_name||"-",
        a.current_role ? `${a.current_role}${a.current_company?" @ "+a.current_company:""}` : "-",
        a.location||"-", a.education_level||"-", String(a.experience_years??"-"),
        (a.skills||[]).map(skillName).slice(0,5).join(", ")||"-", a.interview_status||"-",
      ];
      row.forEach((v,i)=>{ doc.text(String(v).substring(0,30),x,y); x+=colWidths[i]; });
      y+=7;
    });
    doc.save("candidates.pdf");
  };

  const handleDelete = (e, a) => {
    e.preventDefault(); // don't navigate when clicking delete on a card
    e.stopPropagation();
    dispatch(deleteApplicant(a.id));
    let undone = false;
    const { dismiss } = toast({
      title: `${a.full_name} deleted`,
      description: "Undo within 5 seconds.",
      duration: 5000,
      action: (
        <button
          onClick={() => { undone = true; clearTimeout(undoRef.current); dispatch(restoreApplicant(a.id) as any); dismiss(); }}
          className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >Undo</button>
      ),
    });
    undoRef.current = setTimeout(() => {
      if (!undone) dispatch(fetchResults());
    }, 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">All Candidates</h1>
          <p className="text-muted-foreground mt-1">{applicants.length} candidates across all jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCSV}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setAddingCandidate(true)} className="bg-primary hover:bg-primary/90 gap-2">
            <UserPlus className="w-4 h-4" /> Add Candidate
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or skill..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Source filter chips — only shown when candidates are from more than one source */}
        {showSourceFilter && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Source:</span>
            {["all", ...allSources].map(src => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  sourceFilter === src
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {src === "all"
                  ? `All (${applicants.length})`
                  : `${src} (${applicants.filter(a => ((a as any).source || (a as any).sourceType || "manual") === src).length})`
                }
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={User} title="No candidates found" description="Add candidates by going to a job posting" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(a => {
            const result   = getResult(a.id);
            const skills   = (a.skills || []).map(skillName);
            const jobTitle = getJobTitle((a as any).jobId || (a as any).job_id);
            const jobId    = (a as any).jobId || (a as any).job_id;

            return (
              // FIX: entire card is now wrapped in a Link so clicking anywhere navigates to profile
              <Link
                key={a.id}
                to={`/candidates/${a.id}`}
                className="block bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-sm">{a.full_name}</p>
                    {a.current_role && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3" />{a.current_role}{a.current_company && ` at ${a.current_company}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {result && (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border ${
                        (result as any).match_score >= 80 ? "text-accent bg-accent/10 border-accent/20" :
                        (result as any).match_score >= 60 ? "text-primary bg-primary/10 border-primary/20" :
                        "text-warning bg-warning/10 border-warning/20"
                      }`}>{(result as any).match_score}</div>
                    )}
                    {/* FIX: e.preventDefault + e.stopPropagation so card link doesn't fire */}
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setScheduling(a); }}
                      title="Schedule Interview"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10"
                    >
                      <CalendarPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={e => handleDelete(e, a)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {a.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</span>}
                    {a.education_level && <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{a.education_level}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {skills.slice(0,4).map(s => (
                      <span key={s} className="px-1.5 py-0.5 bg-primary/5 text-primary rounded text-[10px]">{s}</span>
                    ))}
                    {skills.length > 4 && <span className="text-[10px] text-muted-foreground">+{skills.length - 4}</span>}
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      {(a as any).source || (a as any).sourceType || "manual"}
                    </span>
                    {/* FIX: only show job link if we can resolve the title */}
                    {jobTitle && jobId ? (
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/jobs/${jobId}`); }}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {jobTitle} →
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">No job assigned</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
          </div>
          {/* FIX: Load More button — only shown when search is empty and more pages exist */}
          {!search && hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="gap-2 min-w-[140px]"
              >
                {loadingMore
                  ? <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Loading...</>
                  : `Load more`
                }
              </Button>
            </div>
          )}
        </>
      )}

      {scheduling && (
        <ScheduleInterviewModal
          applicant={scheduling}
          jobTitle={getJobTitle((scheduling as any).jobId || (scheduling as any).job_id) || ""}
          onClose={() => setScheduling(null)}
          onScheduled={() => { setScheduling(null); loadAll(); }}
        />
      )}
      {addingCandidate && (
        <AddCandidateModal
          jobs={jobs}
          onClose={() => setAddingCandidate(false)}
          onAdded={loadAll}
        />
      )}
    </div>
  );
}
