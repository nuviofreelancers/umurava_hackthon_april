import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchApplicants, deleteApplicant } from "@/store/applicantsSlice";
import { fetchJobs } from "@/store/jobSlice";
import { fetchResults, deleteResultsByApplicant } from "@/store/resultsSlice";
import { User, Search, Briefcase, MapPin, GraduationCap, Trash2, CalendarPlus, UserPlus, Download } from "lucide-react";
import AddCandidateModal from "../components/AddCandidateModal";
import ScheduleInterviewModal from "../components/ScheduleInterviewModal";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import EmptyState from "../components/EmptyState";
import jsPDF from "jspdf";

export default function Candidates() {
  const dispatch = useDispatch();
  const applicants = useSelector(s => s.applicants.list);
  const jobs       = useSelector(s => s.jobs.list);
  const results    = useSelector(s => s.results.list);
  const loading    = useSelector(s => s.applicants.loading);

  const [search, setSearch]               = useState("");
  const [scheduling, setScheduling]       = useState(null);
  const [addingCandidate, setAddingCandidate] = useState(false);
  const { toast } = useToast();
  const undoRef = useRef(null);

  const loadAll = () => {
    dispatch(fetchApplicants());
    dispatch(fetchJobs());
    dispatch(fetchResults());
  };

  useEffect(() => { loadAll(); }, [dispatch]);

  const filtered = applicants.filter(a =>
    !search ||
    a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    (a.skills || []).some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const getJobTitle = (jobId) => jobs.find(j => j.id === jobId)?.title || "Unknown";
  const getResult   = (applicantId) => results.find(r => r.applicant_id === applicantId);

  const exportCSV = () => {
    const headers = ["Name","Email","Phone","Location","Current Role","Company","Experience (yrs)","Education","Skills","Source","Interview Status"];
    const rows = filtered.map(a => [
      a.full_name||"", a.email||"", a.phone||"", a.location||"",
      a.current_role||"", a.current_company||"", a.experience_years??"",
      a.education_level||"", (a.skills||[]).join("; "), a.source||"", a.interview_status||"",
    ]);
    const csv = [headers,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download="candidates.csv"; a.click();
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
        (a.skills||[]).slice(0,5).join(", ")||"-", a.interview_status||"-",
      ];
      row.forEach((v,i)=>{ doc.text(String(v).substring(0,30),x,y); x+=colWidths[i]; });
      y+=7;
    });
    doc.save("candidates.pdf");
  };

  const handleDelete = (a) => {
    // Optimistic removal via Redux
    dispatch(deleteApplicant(a.id));
    let undone = false;
    const { dismiss } = toast({
      title: `${a.full_name} deleted`,
      description: "Undo within 5 seconds.",
      action: (
        <button
          onClick={() => {
            undone = true;
            clearTimeout(undoRef.current);
            // Re-fetch to restore
            dispatch(fetchApplicants());
            dismiss();
          }}
          className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >Undo</button>
      ),
    });
    undoRef.current = setTimeout(() => {
      if (!undone) {
        // deleteApplicant thunk already called; also clean up results
        dispatch(fetchResults());
      }
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name or skill..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={User} title="No candidates found" description="Add candidates by going to a job posting" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(a => {
            const result = getResult(a.id);
            return (
              <div key={a.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all group">
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
                        result.match_score >= 80 ? "text-accent bg-accent/10 border-accent/20" :
                        result.match_score >= 60 ? "text-primary bg-primary/10 border-primary/20" :
                        "text-warning bg-warning/10 border-warning/20"
                      }`}>{result.match_score}</div>
                    )}
                    <button onClick={() => setScheduling(a)} title="Schedule Interview"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10">
                      <CalendarPlus className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(a)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10">
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
                    {(a.skills||[]).slice(0,4).map(s => (
                      <span key={s} className="px-1.5 py-0.5 bg-primary/5 text-primary rounded text-[10px]">{s}</span>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">{a.source}</span>
                    <Link to={`/jobs/${a.job_id}`} className="text-[10px] text-primary hover:underline">
                      {getJobTitle(a.job_id)} →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scheduling && (
        <ScheduleInterviewModal
          applicant={scheduling}
          jobTitle={getJobTitle(scheduling.job_id)}
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
