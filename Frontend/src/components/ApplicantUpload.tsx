import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploads } from "@/api/backend";
import { Upload, Loader2, CheckCircle, FileJson } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function calculateCompleteness(data) {
  const fields = ["full_name", "email", "skills", "experience_years", "education_level", "current_role"];
  const filled = fields.filter(f => { const v = data[f]; return v && (Array.isArray(v) ? v.length > 0 : true); });
  return Math.round((filled.length / fields.length) * 100);
}

export default function ApplicantUpload({ jobId, onUploaded }) {
  const navigate        = useNavigate();
  const [uploading, setUploading]       = useState(false);
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
        const isJson = file.name.toLowerCase().endsWith(".json");
        const source = isJson ? "JSON Upload" : file.name.toLowerCase().endsWith(".pdf") ? "PDF Resume" : "CSV Upload";

        // Tag each candidate with job_id and source, then send to preview
        const tagged = result.candidates.map(c => ({
          ...c,
          job_id: jobId,
          source,
          profile_completeness: calculateCompleteness(c),
        }));

        sessionStorage.setItem("csv_candidates_preview", JSON.stringify(tagged));
        navigate("/candidates/csv-preview");
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
            <p className="text-sm text-muted-foreground">Parsing candidates...</p>
          </div>
        ) : uploadResult ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="w-8 h-8 text-accent" />
            <p className="text-sm font-medium">{uploadResult.count} candidate{uploadResult.count > 1 ? "s" : ""} ready</p>
            <label className="cursor-pointer">
              <span className="text-xs text-primary hover:underline">Upload more</span>
              <input type="file" className="hidden" accept=".csv,.xlsx,.pdf,.json" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-3">
            <div className="flex gap-2 items-center">
              <Upload className="w-7 h-7 text-muted-foreground" />
              <FileJson className="w-6 h-6 text-primary/60" />
            </div>
            <div>
              <p className="text-sm font-medium">Upload Candidates</p>
              <p className="text-xs text-muted-foreground mt-0.5">JSON, CSV/Excel, or PDF resumes</p>
            </div>
            <input type="file" className="hidden" accept=".csv,.xlsx,.pdf,.json" onChange={handleFileUpload} />
          </label>
        )}
      </div>
    </div>
  );
}
