"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      setPending(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setMessage("Account created. You can sign in now.");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setMode("signin");
        return;
      }
      router.replace("/");
      router.refresh();
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-muted-foreground underline"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError(null);
          setMessage(null);
        }}
      >
        {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Create one"}
      </button>
    </form>
  );
}
