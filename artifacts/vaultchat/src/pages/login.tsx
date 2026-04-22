import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, useLogin, useRegister } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading: authLoading } = useAuth();
  
  const login = useLogin();
  const register = useRegister();
  
  if (user) {
    setLocation("/");
    return null;
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Validation Error",
        description: "Username and password are required.",
        variant: "destructive",
      });
      return;
    }
    
    const action = isLogin ? login : register;
    
    action.mutate(
      { username, password },
      {
        onSuccess: () => {
          setLocation("/");
        },
        onError: (error: any) => {
          toast({
            title: isLogin ? "Login Failed" : "Registration Failed",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  };
  
  const isPending = login.isPending || register.isPending;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">VaultChat</h1>
          <p className="text-muted-foreground mt-2">Secure, private, calm communication.</p>
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isPending}
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
                  disabled={isPending}
                  className="bg-background"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border/50 pt-6">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-medium hover:underline focus:outline-none"
                disabled={isPending}
              >
                {isLogin ? "Create one" : "Sign in"}
              </button>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
