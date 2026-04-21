import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploads } from "@/api/backend";
import { Upload, FileJson, FileText, Link as LinkIcon, Image, Tag } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Predefined import source labels for the dropdown
const SOURCE_OPTIONS = [
  { value: "LinkedIn",      label: "LinkedIn" },
  { value: "Upwork",        label: "Upwork" },
  { value: "Umurava",       label: "Umurava" },
  { value: "Direct Upload", label: "Direct Upload" },
  { value: "Referral",      label: "Referral" },
  { value: "Other",         label: "Other" },
];

function calculateCompleteness(data) {
  const fields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
  const filled = fields.filter(f => { const v = data[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });
  return Math.round((filled.length / fields.length) * 100);
}

function tagCandidate(c, jobId, techSource, sourceLabel) {
  return {
    ...c,
    jobId: jobId || undefined,
    source: sourceLabel || techSource,   // user-defined label (LinkedIn, Upwork…)
    sourceType: c.sourceType || techSource,
    profile_completeness: calculateCompleteness(c),
  };
}

// ── Source selector shown after file selection, before upload fires ───────────
function SourceTagStep({ fileName, onConfirm, onCancel, uploading }) {
  const [sourceLabel, setSourceLabel] = useState("Direct Upload");

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground mb-0.5">Selected file</p>
        <p className="text-sm font-medium truncate">{fileName}</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Tag className="w-3.5 h-3.5 text-primary" />
          Where are these candidates from?
        </div>
        <Select value={sourceLabel} onValueChange={setSourceLabel}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Tags this batch so you can filter by source after screening.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={uploading}>
          Cancel
        </Button>
        <Button size="sm" className="flex-1 gap-1.5" onClick={() => onConfirm(sourceLabel)} disabled={uploading}>
          {uploading ? (
            <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Parsing…</>
          ) : (
            <><Upload className="w-3.5 h-3.5" /> Upload</>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function ApplicantUpload({ jobId, onUploaded }) {
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [uploading, setUploading]           = useState(false);
  const [cvUrl, setCvUrl]                   = useState("");
  const [pendingBulkFile, setPendingBulkFile] = useState<File | null>(null);
  const [pendingCvFiles,  setPendingCvFiles]  = useState<File[]>([]);

  const handleResult = (result, techSource, sourceLabel) => {
    if (result?.candidates?.length > 0) {
      const tagged = result.candidates.map(c => tagCandidate(c, jobId, techSource, sourceLabel));
      sessionStorage.setItem("csv_candidates_preview", JSON.stringify(tagged));
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

  // ── Bulk: step 1 — file selected → show source picker ────────────────────
  const handleBulkFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!jobId) { toast({ title: "Select a job first", variant: "destructive", duration: 2000 }); return; }
    setPendingBulkFile(file);
    e.target.value = "";
  };

  // ── Bulk: step 2 — source confirmed → parse + navigate to preview ─────────
  const handleBulkFileConfirm = async (sourceLabel: string) => {
    if (!pendingBulkFile) return;
    setUploading(true);
    try {
      const result = await uploads.parseCandidates(pendingBulkFile, jobId) as any;
      const techSource = pendingBulkFile.name.toLowerCase().endsWith(".json") ? "json" : "csv";
      handleResult(result, techSource, sourceLabel);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive", duration: 3000 });
    }
    setUploading(false);
    setPendingBulkFile(null);
  };

  // ── CV: step 1 — files selected → show source picker ─────────────────────
  const handleCvFileSelect = (e) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    if (!jobId) { toast({ title: "Select a job first", variant: "destructive", duration: 2000 }); return; }
    setPendingCvFiles(files);
    e.target.value = "";
  };

  // ── CV: step 2 — source confirmed → upload each file sequentially ─────────
  const handleCvFileConfirm = async (sourceLabel: string) => {
    if (pendingCvFiles.length === 0) return;
    setUploading(true);
    const allCandidates: any[] = [];
    let failures = 0;

    for (const file of pendingCvFiles) {
      try {
        const result = await uploads.parseCandidates(file, jobId) as any;
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        const techSource = ext === ".pdf" ? "pdf" : [".docx", ".doc"].includes(ext) ? "docx" : "image_ocr";
        if (result?.candidates?.length > 0) {
          allCandidates.push(...result.candidates.map(c => tagCandidate(c, jobId, techSource, sourceLabel)));
        }
      } catch {
        failures++;
      }
    }

    setUploading(false);
    setPendingCvFiles([]);

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

  // ── URL / link — no source picker step, tags as "Link / URL" automatically ─
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
      handleResult(result, "url", "Link / URL");
    } catch (err: any) {
      toast({ title: "URL parsing failed", description: err.message, variant: "destructive", duration: 3000 });
    }
    setUploading(false);
    setCvUrl("");
  };

  // ── Uploading spinner ─────────────────────────────────────────────────────
  if (uploading) {
    return (
      <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Parsing candidate data…</p>
      </div>
    );
  }

  // ── Source tag confirmation (shown after file select, before upload) ───────
  if (pendingBulkFile) {
    return (
      <SourceTagStep
        fileName={pendingBulkFile.name}
        onConfirm={handleBulkFileConfirm}
        onCancel={() => setPendingBulkFile(null)}
        uploading={uploading}
      />
    );
  }

  if (pendingCvFiles.length > 0) {
    return (
      <SourceTagStep
        fileName={pendingCvFiles.length === 1 ? pendingCvFiles[0].name : `${pendingCvFiles.length} files selected`}
        onConfirm={handleCvFileConfirm}
        onCancel={() => setPendingCvFiles([])}
        uploading={uploading}
      />
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
          <input type="file" className="hidden" accept=".csv,.json" onChange={handleBulkFileSelect} />
        </label>
      </TabsContent>

      {/* ── CV / Resume upload ───────────────────────────────────────────── */}
      <TabsContent value="cv" className="space-y-3">
        <label className="cursor-pointer block">
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
            <div className="flex justify-center gap-2 mb-2">
              <FileText className="w-6 h-6 text-primary/60" />
              <Image className="w-6 h-6 text-primary/60" />
            </div>
            <p className="text-sm font-medium">Upload CV(s)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PDF, Word (.docx), or scanned image — select multiple at once
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.tiff,.webp"
            multiple
            onChange={handleCvFileSelect}
          />
        </label>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 border-t border-border" />
          <span>or paste a link</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={cvUrl}
              onChange={e => setCvUrl(e.target.value)}
              placeholder="Google Drive, Docs, LinkedIn, or PDF link…"
              className="pl-8 text-sm"
              onKeyDown={e => e.key === "Enter" && handleCvUrl()}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleCvUrl} disabled={!cvUrl.trim()}>
            Parse
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Works with Google Drive files, Google Docs, LinkedIn profiles, and direct PDF links.
          For Google Drive: share as "Anyone with the link" → paste here.
        </p>
      </TabsContent>
    </Tabs>
  );
}
