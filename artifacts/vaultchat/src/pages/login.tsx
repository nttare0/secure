import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useAuth, useLogin, useRegister } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, Loader2, ArrowRight, Lock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api";

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading: authLoading } = useAuth();

  const login = useLogin();
  const register = useRegister();

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  useEffect(() => {
    if (lockedUntil && lockedUntil > Date.now()) {
      tickRef.current = setInterval(() => setNow(Date.now()), 250);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = null;
      };
    }
    return undefined;
  }, [lockedUntil]);

  const isLocked = !!lockedUntil && lockedUntil > now;
  const lockRemainingMs = isLocked ? lockedUntil! - now : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (!username || !password) {
      toast({
        title: "Validation Error",
        description: "Username and password are required.",
        variant: "destructive",
      });
      return;
    }
    if (!isLogin && !acceptedTerms) {
      toast({
        title: "Terms required",
        description: "You must accept the Terms & Conditions to create an account.",
        variant: "destructive",
      });
      return;
    }

    const onError = (error: unknown) => {
      if (error instanceof ApiError) {
        if (error.status === 429 && error.data?.lockedUntil) {
          const until = Number(error.data.lockedUntil);
          setLockedUntil(until);
          setNow(Date.now());
          setAttemptsLeft(null);
          toast({
            title: "Too many attempts",
            description: "Account temporarily locked. Try again after the timer ends.",
            variant: "destructive",
          });
          return;
        }
        if (error.status === 401 && typeof error.data?.attemptsLeft === "number") {
          setAttemptsLeft(error.data.attemptsLeft);
          toast({
            title: "Login failed",
            description: `${error.message} ${error.data.attemptsLeft} attempt${
              error.data.attemptsLeft === 1 ? "" : "s"
            } remaining before lockout.`,
            variant: "destructive",
          });
          return;
        }
      }
      const msg = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: isLogin ? "Login Failed" : "Registration Failed",
        description: msg,
        variant: "destructive",
      });
    };
    const onSuccess = () => {
      setLockedUntil(null);
      setAttemptsLeft(null);
      setLocation("/");
    };

    if (isLogin) {
      login.mutate({ username, password, rememberMe }, { onSuccess, onError });
    } else {
      register.mutate({ username, password, acceptedTerms }, { onSuccess, onError });
    }
  };

  const isPending = login.isPending || register.isPending;
  const submitDisabled = isPending || isLocked;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">VaultChat</h1>
          <p className="text-muted-foreground mt-2 text-center text-sm sm:text-base">
            Secure, private, calm communication.
          </p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20">
          <CardHeader>
            <CardTitle>{isLogin ? "Welcome back" : "Create your vault"}</CardTitle>
            <CardDescription>
              {isLogin
                ? "Enter your credentials to access your secure rooms."
                : "Set up your credentials to start communicating securely."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLocked && (
              <div className="mb-4 flex items-start gap-3 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Account temporarily locked</p>
                  <p className="text-xs mt-0.5 opacity-90">
                    Too many failed attempts. Try again in{" "}
                    <span className="font-mono font-semibold tabular-nums">
                      {fmtCountdown(lockRemainingMs)}
                    </span>
                    .
                  </p>
                </div>
              </div>
            )}
            {!isLocked && attemptsLeft !== null && attemptsLeft <= 2 && isLogin && (
              <div className="mb-4 flex items-start gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} remaining before a 3-minute lockout.
                </p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitDisabled}
                  autoComplete="username"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitDisabled}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="bg-background"
                />
              </div>

              {isLogin && (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                    disabled={submitDisabled}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    Remember me on this device
                  </Label>
                </div>
              )}

              {!isLogin && (
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="terms"
                    checked={acceptedTerms}
                    onCheckedChange={(v) => setAcceptedTerms(v === true)}
                    disabled={submitDisabled}
                    className="mt-0.5"
                  />
                  <Label htmlFor="terms" className="text-sm font-normal leading-relaxed cursor-pointer">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary font-medium hover:underline">
                      Terms &amp; Conditions
                    </Link>{" "}
                    and acceptable-use policy.
                  </Label>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitDisabled}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isLocked ? (
                  <Lock className="mr-2 h-4 w-4" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {isLocked
                  ? `Locked · ${fmtCountdown(lockRemainingMs)}`
                  : isLogin
                    ? "Sign In"
                    : "Create Account"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-border/50 pt-6">
            <p className="text-sm text-muted-foreground text-center">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setAttemptsLeft(null);
                }}
                className="text-primary font-medium hover:underline focus:outline-none"
                disabled={isPending}
              >
                {isLogin ? "Create one" : "Sign in"}
              </button>
            </p>
            <Link
              href="/terms"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Terms &amp; Conditions
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
