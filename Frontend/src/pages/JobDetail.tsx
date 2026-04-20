import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchJob, updateJob, deleteJob, removeJobOptimistic, restoreJobOptimistic } from "@/store/jobSlice";
import { fetchApplicantsByJob, clearApplicants } from "@/store/applicantsSlice";
import { fetchResultsByJob, runScreening, deleteResultsByJob } from "@/store/resultsSlice";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Edit, Users, Sparkles, Loader2, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ApplicantUpload from "../components/ApplicantUpload";
import ManualApplicantForm from "../components/ManualApplicatForm";
import WeightSliders from "../components/WeightSlider";
import ApplicantList from "../components/ApplicantList";
import ShortlistView from "../components/ShortlistView";
import ScreeningProgress from "../components/ScreeningProgress";

export default function JobDetail() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const { toast } = useToast();

  const job              = useSelector((s: any) => s.jobs.selected);
  const applicantsList   = useSelector((s: any) => s.applicants.list);
  const resultsList      = useSelector((s: any) => s.results.list as any[]);
  const screeningRunning = useSelector((s: any) => s.results.screening);
  const screeningProgress = useSelector((s: any) => s.results.progress);
  const loading          = useSelector((s: any) => s.jobs.loading);

  const sortedResults    = useMemo(() => [...resultsList].sort((a, b) => a.rank - b.rank), [resultsList]);
  const [weights, setWeights]           = useState({ skills: 40, experience: 30, education: 15, relevance: 15 });
  const [shortlistSize, setShortlistSize] = useState<number>(10);

  const loadData = useCallback(() => {
    dispatch(fetchJob(id!) as any);
    // FIX: clear stale candidates first so previous job's list doesn't flash
    dispatch(clearApplicants());
    dispatch(fetchApplicantsByJob({ jobId: id! }) as any);
    dispatch(fetchResultsByJob(id!) as any);
  }, [id, dispatch]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (job?.screening_weights) setWeights(job.screening_weights);
  }, [job]);

  const handleRunScreening = async () => {
    if (applicantsList.length === 0) {
      toast({ title: "No applicants", description: "Add candidates before screening", variant: "destructive" });
      return;
    }
    const clampedSize = Math.min(Math.max(1, shortlistSize), applicantsList.length);
    try {
      await dispatch(updateJob({ id: id!, data: { screening_weights: weights } }) as any);
      await dispatch(runScreening({ jobId: id!, weights, shortlistSize: clampedSize }) as any).unwrap();
      toast({ title: "Screening complete", description: `Top ${clampedSize} candidates ranked.` });
      loadData();
    } catch (e: any) {
      toast({ title: "Screening failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteJob = () => {
    if (!job) return;
    let undone = false;

    // Optimistically remove from Redux immediately so the list updates at once
    dispatch(removeJobOptimistic(id!));
    navigate("/jobs");

    const { dismiss } = toast({
      title: `"${job.title}" deleted`,
      description: "Undo within 5 seconds.",
      duration: 5000,
      action: (
        <button
          onClick={() => {
            undone = true;
            dismiss();
            // Restore the job in Redux and go back
            dispatch(restoreJobOptimistic(job));
            navigate(`/jobs/${id}`);
          }}
          className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >Undo</button>
      ),
    });

    setTimeout(async () => {
      if (!undone) {
        try {
          await dispatch(deleteResultsByJob(id!) as any);
          for (const a of applicantsList as any[]) await applicantsApi.delete(a.id);
          await dispatch(deleteJob(id!) as any);
        } catch { /* silent */ }
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
  if (!job) {
    return <p className="text-center text-muted-foreground py-16">Job not found</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate("/jobs")} className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold">{job.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {job.department && <span>{job.department}</span>}
              {job.location   && <span>· {job.location}</span>}
              {job.experience_level && <span>· {job.experience_level}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/jobs/new?edit=${id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleDeleteJob}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>

      {screeningRunning && <ScreeningProgress progress={screeningProgress} />}

      <Tabs defaultValue={sortedResults.length > 0 ? "shortlist" : "applicants"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="applicants" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Applicants ({applicantsList.length})
          </TabsTrigger>
          <TabsTrigger value="shortlist" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Shortlist ({sortedResults.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applicants" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ApplicantList applicants={applicantsList} onRefresh={loadData} />
            </div>
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <h3 className="font-heading font-semibold text-sm">Add Candidates</h3>
                <Tabs defaultValue="upload">
                  <TabsList className="w-full">
                    <TabsTrigger value="upload" className="flex-1 text-xs">Upload</TabsTrigger>
                    <TabsTrigger value="manual" className="flex-1 text-xs">Manual</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="mt-3">
                    <ApplicantUpload jobId={id!} onUploaded={loadData} />
                  </TabsContent>
                  <TabsContent value="manual" className="mt-3">
                    <ManualApplicantForm jobId={id!} onAdded={loadData} />
                  </TabsContent>
                </Tabs>
              </div>

              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <WeightSliders weights={weights} onChange={setWeights} />

                {/* Shortlist size control */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Shortlist size
                    <span className="ml-1 text-muted-foreground/60">(max {applicantsList.length})</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={applicantsList.length || 100}
                    value={shortlistSize}
                    onChange={e => setShortlistSize(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-8 text-sm"
                  />
                </div>

                <Button
                  onClick={handleRunScreening}
                  disabled={screeningRunning || applicantsList.length === 0}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
                >
                  {screeningRunning ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Screening...</>
                  ) : resultsList.length > 0 ? (
                    <><RefreshCw className="w-4 h-4" /> Re-Screen Candidates</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Run AI Screening</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shortlist">
          <ShortlistView results={sortedResults} applicants={applicantsList} job={job} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
