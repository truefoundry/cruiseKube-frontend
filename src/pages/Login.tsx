import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { publicUrl } from "@/lib/public-asset";

const logoMaskUrl = publicUrl("logo.svg");

export default function Login() {
  const { login, isAuthenticated, isSubmitting, authEnabled, authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    typeof (location.state as { from?: string } | null)?.from === "string"
      ? (location.state as { from: string }).from
      : "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authEnabled) {
    return <Navigate to={from === "/login" ? "/" : from} replace />;
  }

  if (isAuthenticated) {
    return <Navigate to={from === "/login" ? "/" : from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    try {
      await login({ username: username.trim(), password });
      navigate(from === "/login" ? "/" : from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6 text-foreground sm:p-8">
      {/* Theme-aligned soft canvas */}
      <div
        className="pointer-events-none absolute inset-0 bg-background"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,hsl(var(--primary)/0.14),transparent_58%)] dark:bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,hsl(var(--primary)/0.18),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_45%_at_100%_100%,hsl(var(--info)/0.10),transparent_52%)] dark:bg-[radial-gradient(ellipse_65%_45%_at_100%_100%,hsl(var(--info)/0.14),transparent_52%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-background/40 to-primary/5"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[length:4rem_4rem] opacity-[0.18] dark:opacity-[0.08]"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-surface-elevated shadow-card ring-1 ring-border/45">
            <div
              className="h-14 w-14 shrink-0 bg-primary"
              style={{
                maskImage: `url(${logoMaskUrl})`,
                WebkitMaskImage: `url(${logoMaskUrl})`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
              }}
              role="img"
              aria-label="CruiseKube logo"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              CruiseKube
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">Kubernetes workload optimizer</p>
          </div>
        </div>

        <Card className="w-full border-border/80 bg-card/95 shadow-card backdrop-blur-md ring-1 ring-border/45">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription className="text-pretty leading-relaxed">
              Use your credentials to sign in.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  className="bg-surface-elevated/80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="bg-surface-elevated/80"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-border/40 pt-6 sm:flex-row sm:justify-end">
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto min-w-[8rem]">
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </CardFooter>
          </form>
          <div className="border-t border-border/40 px-6 py-4 text-center text-xs text-muted-foreground">
            <a
              href="https://cruisekube.com/documentation/operate/authentication/"
              className="font-medium text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
