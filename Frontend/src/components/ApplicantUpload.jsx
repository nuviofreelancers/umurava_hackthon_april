import { useState } from "react";
import { uploads, applicants as applicantsApi } from "@/api/backend";
import { Upload, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function calculateCompleteness(data) {
  const fields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
  const filled = fields.filter(f => { const v = data[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });
  return Math.round((filled.length / fields.length) * 100);
}

export default function ApplicantUpload({ jobId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const { toast } = useToast();

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!jobId) {
      toast({ title: "Select a job first", variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const result = await uploads.parseCandidates(file, jobId);

      if (result?.candidates?.length > 0) {
        // Bulk create — backend handles duplicate logic
        await applicantsApi.bulkCreate(
          result.candidates.map(c => ({
            ...c,
            job_id: jobId,
            source: file.name.endsWith(".pdf") ? "PDF Resume" : "CSV Upload",
            profile_completeness: calculateCompleteness(c),
          }))
        );
        setUploadResult({ count: result.candidates.length });
        toast({ title: "Import complete", description: `${result.candidates.length} candidate(s) imported` });
        onUploaded?.();
      } else {
        toast({ title: "No candidates found", description: "Check the file format and try again.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }

    setUploading(false);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Parsing and importing candidates...</p>
          </div>
        ) : uploadResult ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="w-8 h-8 text-accent" />
            <p className="text-sm font-medium">{uploadResult.count} candidate{uploadResult.count > 1 ? "s" : ""} imported</p>
            <label className="cursor-pointer">
              <span className="text-xs text-primary hover:underline">Upload more</span>
              <input type="file" className="hidden" accept=".csv,.xlsx,.pdf" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Upload Candidates</p>
              <p className="text-xs text-muted-foreground mt-0.5">CSV/Excel for bulk import, or PDF resumes</p>
            </div>
            <input type="file" className="hidden" accept=".csv,.xlsx,.pdf" onChange={handleFileUpload} />
          </label>
        )}
      </div>
    </div>
  );
}
