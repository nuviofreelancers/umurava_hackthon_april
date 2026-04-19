import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploads } from "@/api/backend";
import { Upload, Loader2, CheckCircle, FileJson, FileText, Link as LinkIcon, Image } from "lucide-react";
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
  return { ...c, job_id: jobId, source, profile_completeness: calculateCompleteness(c) };
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
      navigate("/candidates/csv-preview");
    } else {
      toast({ title: "No candidates found", description: "Check the file format and try again.", variant: "destructive" });
    }
  };

  // ── Bulk file upload (CSV / JSON) ─────────────────────────────────────────
  const handleBulkFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!jobId) { toast({ title: "Select a job first", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const result = await uploads.parseCandidates(file, jobId);
      const source = file.name.toLowerCase().endsWith(".json") ? "JSON Upload" : "CSV Upload";
      handleResult(result, source);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
    e.target.value = "";
  };

  // ── Single CV file upload (PDF / Word / image) ────────────────────────────
  const handleCvFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!jobId) { toast({ title: "Select a job first", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const result = await uploads.parseCandidates(file, jobId);
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      const source = ext === ".pdf" ? "PDF Resume" : [".docx", ".doc"].includes(ext) ? "Word Resume" : "Scanned Resume";
      handleResult(result, source);
    } catch (err: any) {
      toast({ title: "CV parsing failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
    e.target.value = "";
  };

  // ── URL / link ────────────────────────────────────────────────────────────
  const handleCvUrl = async () => {
    if (!cvUrl.trim()) return;
    if (!jobId) { toast({ title: "Select a job first", variant: "destructive" }); return; }
    try { new URL(cvUrl); } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid URL (including https://)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const result = await uploads.parseCandidateFromUrl(cvUrl, jobId);
      handleResult(result, "Link / URL");
    } catch (err: any) {
      toast({ title: "URL parsing failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
    setCvUrl("");
  };

  if (uploading) {
    return (
      <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground mt-2">Parsing candidate data...</p>
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
        {/* File drop */}
        <label className="cursor-pointer block">
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
            <div className="flex justify-center gap-2 mb-2">
              <FileText className="w-6 h-6 text-primary/60" />
              <Image className="w-6 h-6 text-primary/60" />
            </div>
            <p className="text-sm font-medium">Upload a CV</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PDF, Word (.docx), or scanned image — AI will extract candidate data
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.tiff,.webp"
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
