import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploads } from "@/api/backend";
import { Upload, Loader2, FileJson, FileText, Link as LinkIcon, Image } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function calculateCompleteness(data) {
  const fields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
  const filled = fields.filter(f => { const v = data[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });
  return Math.round((filled.length / fields.length) * 100);
}

function tagCandidate(c, jobId, source) {
  return {
    ...c,
    jobId: jobId || undefined,   // backend bulkCreate expects jobId, not job_id
    source,
    sourceType: c.sourceType || source,
    profile_completeness: calculateCompleteness(c),
  };
}

export default function ApplicantUpload({ jobId, onUploaded }) {
  const navigate       = useNavigate();
  const { toast }      = useToast();
  const [uploading, setUploading] = useState(false);
  const [cvUrl, setCvUrl]         = useState("");

  const handleResult = (result, source) => {
    if (result?.candidates?.length > 0) {
      const tagged = result.candidates.map(c => tagCandidate(c, jobId, source));
      sessionStorage.setItem("csv_candidates_preview", JSON.stringify(tagged));
      // Warn if some rows were skipped
      if (result.parseErrors?.length > 0) {
        toast({
          title: `${result.parseErrors.length} row(s) skipped`,
          description: "Some rows could not be parsed and were excluded.",
          duration: 4000,
        });
      }
      navigate("/candidates/csv-preview");
    } else {
      toast({ title: "No candidates found", description: "Check the file format and try again.", variant: "destructive", duration: 3000 });
    }
  };

  // ── Bulk file upload (CSV / JSON) ─────────────────────────────────────────
  const handleBulkFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!jobId) { toast({ title: "Select a job first", variant: "destructive", duration: 2000 }); return; }
    setUploading(true);
    try {
      const result = await uploads.parseCandidates(file, jobId);
      const source = file.name.toLowerCase().endsWith(".json") ? "JSON Upload" : "CSV Upload";
      handleResult(result, source);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive", duration: 3000 });
    }
    setUploading(false);
    e.target.value = "";
  };

  // ── Single OR multiple CV file upload (PDF / Word / image) ───────────────
  // FIX: now accepts multiple files — each is uploaded sequentially and all
  // candidates are merged into one preview batch
  const handleCvFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!jobId) { toast({ title: "Select a job first", variant: "destructive", duration: 2000 }); return; }
    setUploading(true);
    const allCandidates: any[] = [];
    let failures = 0;

    for (const file of files) {
      try {
        const result = await uploads.parseCandidates(file as File, jobId) as any;
        const ext = (file as File).name.slice((file as File).name.lastIndexOf(".")).toLowerCase();
        const source = ext === ".pdf" ? "PDF Resume" : [".docx", ".doc"].includes(ext) ? "Word Resume" : "Scanned Resume";
        if (result?.candidates?.length > 0) {
          allCandidates.push(...result.candidates.map(c => tagCandidate(c, jobId, source)));
        }
      } catch {
        failures++;
      }
    }

    setUploading(false);
    e.target.value = "";

    if (failures > 0 && allCandidates.length === 0) {
      toast({ title: "All files failed to parse", description: "Check that the files are valid resumes.", variant: "destructive", duration: 3000 });
      return;
    }
    if (failures > 0) {
      toast({ title: `${failures} file${failures > 1 ? "s" : ""} could not be parsed`, description: "Continuing with the ones that succeeded.", duration: 3000 });
    }

    if (allCandidates.length > 0) {
      sessionStorage.setItem("csv_candidates_preview", JSON.stringify(allCandidates));
      navigate("/candidates/csv-preview");
    }
  };

  // ── URL / link ────────────────────────────────────────────────────────────
  const handleCvUrl = async () => {
    if (!cvUrl.trim()) return;
    if (!jobId) { toast({ title: "Select a job first", variant: "destructive", duration: 2000 }); return; }
    try { new URL(cvUrl); } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid URL (including https://)", variant: "destructive", duration: 3000 });
      return;
    }
    setUploading(true);
    try {
      const result = await uploads.parseCandidateFromUrl(cvUrl, jobId);
      handleResult(result, "Link / URL");
    } catch (err: any) {
      toast({ title: "URL parsing failed", description: err.message, variant: "destructive", duration: 3000 });
    }
    setUploading(false);
    setCvUrl("");
  };

  // FIX: replaced text-based loading with a proper spinner circle
  if (uploading) {
    return (
      <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3">
        <div className="relative w-10 h-10">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Parsing candidate data...</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="bulk" className="space-y-3">
      <TabsList className="w-full">
        <TabsTrigger value="bulk" className="flex-1 text-xs gap-1.5">
          <FileJson className="w-3.5 h-3.5" /> Bulk (CSV / JSON)
        </TabsTrigger>
        <TabsTrigger value="cv" className="flex-1 text-xs gap-1.5">
          <FileText className="w-3.5 h-3.5" /> CV / Resume
        </TabsTrigger>
      </TabsList>

      {/* ── Bulk upload ──────────────────────────────────────────────────── */}
      <TabsContent value="bulk">
        <label className="cursor-pointer block">
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
            <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Upload Candidates</p>
            <p className="text-xs text-muted-foreground mt-0.5">CSV or JSON — multiple candidates at once</p>
          </div>
          <input type="file" className="hidden" accept=".csv,.json" onChange={handleBulkFile} />
        </label>
      </TabsContent>

      {/* ── CV / Resume upload ───────────────────────────────────────────── */}
      <TabsContent value="cv" className="space-y-3">
        {/* FIX: added `multiple` attribute so user can select several resumes at once */}
        <label className="cursor-pointer block">
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
            <div className="flex justify-center gap-2 mb-2">
              <FileText className="w-6 h-6 text-primary/60" />
              <Image className="w-6 h-6 text-primary/60" />
            </div>
            <p className="text-sm font-medium">Upload CV(s)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PDF, Word (.docx), or scanned image — select multiple files at once
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.tiff,.webp"
            multiple
            onChange={handleCvFile}
          />
        </label>

        {/* Divider */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 border-t border-border" />
          <span>or paste a link</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* URL input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={cvUrl}
              onChange={e => setCvUrl(e.target.value)}
              placeholder="Google Drive, Docs, LinkedIn, or PDF link..."
              className="pl-8 text-sm"
              onKeyDown={e => e.key === "Enter" && handleCvUrl()}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleCvUrl} disabled={!cvUrl.trim()}>
            Parse
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Works with Google Drive files, Google Docs, LinkedIn profiles, portfolio sites, and direct PDF links.
          For Google Drive: share the file → "Anyone with the link" → paste the link here.
        </p>
      </TabsContent>
    </Tabs>
  );
}


