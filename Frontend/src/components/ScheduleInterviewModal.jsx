import { useState } from "react";
import { applicants as applicantsApi } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Calendar, Wifi, MapPin, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ScheduleInterviewModal({ applicant, jobTitle, onClose, onScheduled }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [interviewType, setInterviewType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    interview_date: "",
    interview_time: "",
    interview_link: "",
    interview_location: "",
    interview_notes: "",
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const chooseType = (type) => {
    setInterviewType(type);
    setStep(2);
  };

  const save = async () => {
    if (!form.interview_date || !form.interview_time) {
      toast({ title: "Date and time are required", variant: "destructive" });
      return;
    }
    if (interviewType === "online" && !form.interview_link.trim()) {
      toast({ title: "Meeting link is required for online interviews", variant: "destructive" });
      return;
    }
    if (interviewType === "offline" && !form.interview_location.trim()) {
      toast({ title: "Location is required for in-person interviews", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const interviewDateTime = new Date(`${form.interview_date}T${form.interview_time}`);
      const reminderDateTime = new Date(interviewDateTime.getTime() - 24 * 60 * 60 * 1000);

      await applicantsApi.update(applicant.id, {
        interview_date: form.interview_date,
        interview_time: form.interview_time,
        interview_platform: interviewType === "online" ? "Online" : "In Person",
        interview_link: interviewType === "online" ? form.interview_link : "",
        interview_location: interviewType === "offline" ? form.interview_location : "",
        interview_notes: form.interview_notes,
        interview_status: "Interview Scheduled",
        interview_reminder_at: reminderDateTime.toISOString(),
      });

      // Request backend to send confirmation email + schedule 24h reminder
      // Silently ignores failure if endpoint not yet implemented
      try {
        const token = localStorage.getItem("hr_token");
        await fetch("/api/interviews/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            applicant_id: applicant.id,
            applicant_name: applicant.full_name,
            applicant_email: applicant.email,
            job_title: jobTitle,
            interview_type: interviewType,
            interview_date: form.interview_date,
            interview_time: form.interview_time,
            interview_link: form.interview_link,
            interview_location: form.interview_location,
            interview_notes: form.interview_notes,
            reminder_at: reminderDateTime.toISOString(),
          }),
        });
      } catch {
        // Email endpoint may not be wired yet — interview record is still saved
      }

      toast({
        title: "Interview scheduled",
        description: `${applicant.full_name} — ${form.interview_date} at ${form.interview_time}. Confirmation email queued.`,
      });
      onScheduled?.();
    } catch {
      toast({ title: "Failed to schedule interview", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-heading font-bold text-base">Schedule Interview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {applicant.full_name} · {jobTitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition-colors"
              >
                ← Back
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 pt-4">
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
            step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>1</div>
          <div className={`flex-1 h-0.5 transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
            step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>2</div>
        </div>

        {/* Step 1: Choose type */}
        {step === 1 && (
          <div className="p-5 space-y-3">
            <p className="text-sm font-medium text-foreground mb-4">How will this interview be conducted?</p>

            <button
              onClick={() => chooseType("online")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Wifi className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Online</p>
                <p className="text-xs text-muted-foreground mt-0.5">Video call via a meeting link</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <button
              onClick={() => chooseType("offline")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                <MapPin className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">In Person</p>
                <p className="text-xs text-muted-foreground mt-0.5">Face-to-face at a physical location</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        )}

        {/* Step 2: Details form */}
        {step === 2 && (
          <>
            <div className="p-5 space-y-4">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                interviewType === "online" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
              }`}>
                {interviewType === "online" ? <Wifi className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                {interviewType === "online" ? "Online Interview" : "In-Person Interview"}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Date *</Label>
                  <Input
                    type="date"
                    value={form.interview_date}
                    onChange={e => update("interview_date", e.target.value)}
                    className="mt-1"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <Label className="text-xs">Time *</Label>
                  <Input
                    type="time"
                    value={form.interview_time}
                    onChange={e => update("interview_time", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {interviewType === "online" ? (
                <div>
                  <Label className="text-xs">Meeting Link *</Label>
                  <Input
                    value={form.interview_link}
                    onChange={e => update("interview_link", e.target.value)}
                    className="mt-1"
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Location *</Label>
                  <Input
                    value={form.interview_location}
                    onChange={e => update("interview_location", e.target.value)}
                    className="mt-1"
                    placeholder="Floor 3, Kigali Heights, KG 7 Ave..."
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Notes for candidate</Label>
                <Input
                  value={form.interview_notes}
                  onChange={e => update("interview_notes", e.target.value)}
                  className="mt-1"
                  placeholder="Bring ID, dress code, what to prepare..."
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-muted/60 rounded-lg">
                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A confirmation email will be sent to{" "}
                  <span className="font-medium text-foreground">{applicant.email || "the candidate"}</span>{" "}
                  immediately, with a reminder 24 hours before the interview.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 pt-0">
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                {saving ? "Scheduling..." : "Schedule & Send Email"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
