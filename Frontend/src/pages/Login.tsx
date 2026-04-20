import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";

function parseLoginError(err: any): string {
  const msg: string = err?.message || "";
  if (msg.includes("Session expired")) return "Your session expired. Please sign in again.";
  if (msg.includes("User not found") || msg.includes("user not found"))
    return "No account found with that email address.";
  if (msg.includes("Wrong password") || msg.includes("wrong password") || msg.includes("Invalid password"))
    return "Incorrect password. Please try again.";
  if (msg.includes("Server error") || msg.includes("500"))
    return "Something went wrong on our end. Please try again shortly.";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network"))
    return "Cannot reach the server. Check your connection and try again.";
  if (msg) return msg;
  return "Login failed. Please check your credentials and try again.";
}

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  // FIX: detect ?session=expired in URL (set by the 401 auto-logout in api/backend.ts)
  const sessionExpired = new URLSearchParams(window.location.search).get("session") === "expired";

  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (!password)     { setError("Please enter your password."); return; }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(parseLoginError(err));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-2">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">TalentScreen</h1>
          <p className="text-sm text-muted-foreground">AI-Powered Hiring — sign in to continue</p>
        </div>

        {/* FIX: session-expired banner shown when auto-logged-out due to expired token */}
        {sessionExpired && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm leading-snug">Your session expired. Please sign in again.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="Password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* FIX: specific, actionable error messages */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive leading-snug">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Signing in...</> : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
