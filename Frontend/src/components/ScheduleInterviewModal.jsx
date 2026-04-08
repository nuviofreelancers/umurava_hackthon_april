import { useState } from "react";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PLATFORMS = ["Google Meet", "Microsoft Teams", "Zoom", "In Person", "Phone Call"];

export default function ScheduleInterviewModal({ applicant, jobTitle, onClose, onScheduled }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    interview_date: "",
    interview_time: "",
    interview_platform: "Google Meet",
    interview_link: "",
    interview_notes: "",
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.interview_date || !form.interview_time) {
      toast({ title: "Date and time are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await applicantsApi.update(applicant.id, {
        ...form,
        interview_status: "Interview Scheduled",
      });
      toast({ title: "Interview scheduled", description: `${applicant.full_name} — ${form.interview_date} at ${form.interview_time}` });
      onScheduled?.();
    } catch {
      toast({ title: "Failed to schedule interview", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-xl animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-heading font-bold text-base">Schedule Interview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{applicant.full_name} · {jobTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={form.interview_date} onChange={e => update("interview_date", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Time *</Label>
              <Input type="time" value={form.interview_time} onChange={e => update("interview_time", e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Platform</Label>
            <Select value={form.interview_platform} onValueChange={v => update("interview_platform", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Meeting Link / Address</Label>
            <Input value={form.interview_link} onChange={e => update("interview_link", e.target.value)} className="mt-1" placeholder="https://meet.google.com/..." />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={form.interview_notes} onChange={e => update("interview_notes", e.target.value)} className="mt-1" placeholder="Any instructions for the candidate..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 pt-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            {saving ? "Scheduling..." : "Schedule Interview"}
          </Button>
        </div>
      </div>
    </div>
  );
}
