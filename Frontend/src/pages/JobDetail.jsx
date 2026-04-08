import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { jobs as jobsApi, applicants as applicantsApi, results as resultsApi, screening } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Users, Sparkles, Loader2, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ApplicantUpload from "../components/ApplicantUpload";
import ManualApplicantForm from "../components/ManualApplicatForm";
import WeightSliders from "../components/WeightSlider";
import ApplicantList from "../components/ApplicantList";
import ShortlistView from "../components/ShortlistView";
import ScreeningProgress from "../components/ScreeningProgress";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState(null);
  const [applicantsList, setApplicantsList] = useState([]);
  const [resultsList, setResultsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screeningRunning, setScreeningRunning] = useState(false);
  const [screeningProgress, setScreeningProgress] = useState(0);
  const [weights, setWeights] = useState({ skills: 40, experience: 30, education: 15, relevance: 15 });

  const loadData = useCallback(async () => {
    try {
      const [jobData, apps, res] = await Promise.all([
        jobsApi.get(id),
        applicantsApi.listByJob(id),
        resultsApi.listByJob(id),
      ]);
      setJob(jobData);
      setWeights(jobData.screening_weights || { skills: 40, experience: 30, education: 15, relevance: 15 });
      setApplicantsList(apps);
      setResultsList(res.sort((a, b) => a.rank - b.rank));
    } catch {
      toast({ title: "Failed to load job", variant: "destructive" });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const runScreening = async () => {
    if (applicantsList.length === 0) {
      toast({ title: "No applicants", description: "Add candidates before screening", variant: "destructive" });
      return;
    }
    setScreeningRunning(true);
    setScreeningProgress(20);
    try {
      await jobsApi.update(id, { screening_weights: weights });
      setScreeningProgress(40);
      const result = await screening.run(id, weights);
      setScreeningProgress(100);
      toast({ title: "Screening complete", description: `${result?.count || 0} candidates ranked` });
      setTimeout(() => {
        setScreeningRunning(false);
        setScreeningProgress(0);
        loadData();
      }, 500);
    } catch (e) {
      toast({ title: "Screening failed", description: e.message, variant: "destructive" });
      setScreeningRunning(false);
      setScreeningProgress(0);
    }
  };

  const deleteJob = () => {
    let undone = false;
    const { dismiss } = toast({
      title: `"${job.title}" will be deleted`,
      description: "Undo within 30 seconds.",
      duration: 30000,
      action: (
        <button
          onClick={() => { undone = true; dismiss(); }}
          className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Undo
        </button>
      ),
    });
    navigate("/jobs");
    setTimeout(async () => {
      if (!undone) {
        try {
          await resultsApi.deleteByJob(id);
          // delete applicants one by one (backend can also support bulk delete)
          for (const a of applicantsList) await applicantsApi.delete(a.id);
          await jobsApi.delete(id);
        } catch { /* silent — user already navigated away */ }
      }
    }, 30000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) return <p className="text-muted-foreground text-center py-16">Job not found</p>;

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
              {job.location && <span>· {job.location}</span>}
              <span>· {job.experience_level}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/jobs/new?edit=${id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={deleteJob}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>

      {screeningRunning && <ScreeningProgress progress={screeningProgress} />}

      <Tabs defaultValue={resultsList.length > 0 ? "shortlist" : "applicants"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="applicants" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Applicants ({applicantsList.length})
          </TabsTrigger>
          <TabsTrigger value="shortlist" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Shortlist ({resultsList.length})
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
                    <ApplicantUpload jobId={id} onUploaded={loadData} />
                  </TabsContent>
                  <TabsContent value="manual" className="mt-3">
                    <ManualApplicantForm jobId={id} onAdded={loadData} />
                  </TabsContent>
                </Tabs>
              </div>
              <div className="bg-card rounded-xl border border-border p-5">
                <WeightSliders weights={weights} onChange={setWeights} />
                <Button
                  onClick={runScreening}
                  disabled={screeningRunning || applicantsList.length === 0}
                  className="w-full mt-4 bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
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
          <ShortlistView results={resultsList} applicants={applicantsList} job={job} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
