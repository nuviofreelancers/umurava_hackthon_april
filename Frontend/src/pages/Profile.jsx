import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useDispatch, useSelector } from "react-redux";
import { auth } from "@/api/backend";
import { loadCurrentUser } from "@/store/authSlice";

export default function Profile() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    phone_number: user?.phone_number || "",
    specialisation: user?.specialisation || "",
    bio: user?.bio || "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await auth.updateMe(form);
      await dispatch(loadCurrentUser());
      toast({ title: "Profile updated successfully" });
    } catch {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setForm({
      full_name: user?.full_name || "",
      phone_number: user?.phone_number || "",
      specialisation: user?.specialisation || "",
      bio: user?.bio || "",
    });
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal information and account preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Profile */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="font-heading font-semibold text-lg">My Profile</h2>

          {/* Avatar */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
              {initials}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Full Name</label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input value={user?.email || ""} disabled className="bg-muted text-muted-foreground" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone Number</label>
              <Input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="+1 234 567 890" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Specialisation</label>
              <Input value={form.specialisation} onChange={e => setForm(f => ({ ...f, specialisation: e.target.value }))} placeholder="e.g. Software Development, Data Science" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Tell us about yourself, your experience and interests..."
                rows={4}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4 h-fit">
          <h2 className="font-heading font-semibold text-lg">Account Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your account settings and preferences.</p>
          <div className="pt-2 border-t border-border space-y-3">
            <p className="text-xs text-muted-foreground">
              To change your password or delete your account, please contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
