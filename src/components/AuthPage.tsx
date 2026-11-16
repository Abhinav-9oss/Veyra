import { useState, type FormEvent } from "react";
import { Sparkles, Mail, Lock, User, AtSign, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui";

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, username, displayName);
    setLoading(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-ink-900 bg-hero-radial relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-faint bg-[size:40px_40px] opacity-40 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl animate-pulse-glow pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-electric-600/15 rounded-full blur-3xl animate-pulse-glow pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-electric-600 shadow-glow mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Veyra<span className="text-violet-400">.</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Your digital world, amplified.</p>
        </div>

        <div className="glass-strong rounded-3xl p-7 shadow-glow-soft">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-ink-700/60 rounded-xl mb-6">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-glow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <Field
                  icon={<AtSign className="w-4 h-4" />}
                  placeholder="Username"
                  value={username}
                  onChange={setUsername}
                  autoComplete="username"
                />
                <Field
                  icon={<User className="w-4 h-4" />}
                  placeholder="Display name"
                  value={displayName}
                  onChange={setDisplayName}
                  autoComplete="name"
                />
              </>
            )}
            <Field
              icon={<Mail className="w-4 h-4" />}
              placeholder="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <Field
              icon={<Lock className="w-4 h-4" />}
              placeholder="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />

            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" icon={<ArrowRight className="w-4 h-4" />}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-5">
            By continuing you agree to Veyra's Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">{icon}</span>
      <input
        className="input-field pl-11"
        placeholder={placeholder}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}
