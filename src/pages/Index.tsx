import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Github, Rocket, Code, Zap } from "lucide-react";

const Index = () => {
  const { user, loading, signInWithGithub } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSignIn = async () => {
    await signInWithGithub();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Github className="h-12 w-12 text-accent" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                JATE AI
              </h1>
            </div>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Deploy your GitHub repositories to AWS with AI-powered infrastructure generation
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 my-12">
            <div className="p-6 rounded-lg border bg-card">
              <Code className="h-10 w-10 text-accent mx-auto mb-4" />
              <h3 className="font-semibold mb-2">GitHub Integration</h3>
              <p className="text-sm text-muted-foreground">
                Connect your repositories and deploy with ease
              </p>
            </div>
            
            <div className="p-6 rounded-lg border bg-card">
              <Zap className="h-10 w-10 text-accent mx-auto mb-4" />
              <h3 className="font-semibold mb-2">AI-Powered</h3>
              <p className="text-sm text-muted-foreground">
                Let AI generate optimal infrastructure configurations
              </p>
            </div>
            
            <div className="p-6 rounded-lg border bg-card">
              <Rocket className="h-10 w-10 text-accent mx-auto mb-4" />
              <h3 className="font-semibold mb-2">AWS Deployment</h3>
              <p className="text-sm text-muted-foreground">
                Deploy to AWS with SST framework support
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Button size="lg" onClick={handleSignIn} className="text-lg px-8 py-6">
              <Github className="mr-2 h-5 w-5" />
              Sign in with GitHub
            </Button>
            
            <p className="text-sm text-muted-foreground">
              Start deploying your projects in minutes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
