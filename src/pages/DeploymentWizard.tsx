import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Github, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddProjectModal } from "@/components/AddProjectModal";

interface Project {
  id: string;
  name: string;
  github_repo_url: string | null;
  branch_name: string;
  description: string | null;
}

const AWS_SERVICES = [
  "Lambda", "API Gateway", "DynamoDB", "S3", "RDS", 
  "SQS", "SNS", "EventBridge", "Step Functions", "CloudFront"
];

const STEPS = [
  {
    number: 1,
    title: "Select Repository",
    subtitle: "Choose your GitHub repository"
  },
  {
    number: 2,
    title: "Configure Infrastructure",
    subtitle: "Describe your deployment needs"
  },
  {
    number: 3,
    title: "Review & Deploy",
    subtitle: "Review generated configuration"
  }
];

export default function DeploymentWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showAddProject, setShowAddProject] = useState(false);
  const [aiResponse, setAiResponse] = useState<{
    sstConfig: string;
    suggestedChanges: string;
    iamPolicy: string;
  } | null>(null);

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching projects",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const handleNext = async () => {
    if (step === 1 && !selectedProject) {
      toast({
        title: "Select a repository",
        description: "Please select a repository to continue",
        variant: "destructive"
      });
      return;
    }

    if (step === 2 && !prompt.trim()) {
      toast({
        title: "Enter a prompt",
        description: "Please describe your infrastructure needs",
        variant: "destructive"
      });
      return;
    }

    if (step === 2) {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-sst-config', {
          body: {
            prompt,
            projectName: selectedProjectData?.name,
            repository: selectedProjectData?.github_repo_url
          }
        });

        if (error) {
          console.error('Supabase function error:', error);
          throw error;
        }

        if (data?.error) {
          console.error('Function returned error:', data.error);
          throw new Error(data.error);
        }

        console.log('Received AI response:', data);
        setAiResponse(data);
        setStep(3);
        
        toast({
          title: "Configuration generated",
          description: "Review the generated configuration in the next step"
        });
      } catch (error: any) {
        console.error('Error in wizard:', error);
        toast({
          title: "Error generating configuration",
          description: error.message || "Failed to generate configuration",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 1) {
      navigate("/dashboard");
    } else {
      setStep(Math.max(1, step - 1));
    }
  };

  const handleApply = async () => {
    toast({
      title: "Deployment initiated",
      description: "Your SST configuration is being applied"
    });
    navigate("/dashboard");
  };

  const addServiceTag = (service: string) => {
    setPrompt(prev => prev + (prev ? " " : "") + service);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-primary">Deployment Wizard</h1>
            <div className="w-[140px]" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Breadcrumb Steps */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center gap-8 max-w-4xl mx-auto">
            {STEPS.map((s, idx) => (
              <div key={s.number} className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold transition-colors ${
                      step >= s.number
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.number}
                  </div>
                  <div>
                    <h3
                      className={`font-semibold ${
                        step >= s.number ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{s.subtitle}</p>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 w-16 ${step > s.number ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Step 1: Select Repository */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Select Repository</h2>
                <p className="text-muted-foreground">
                  Choose a GitHub repository for deployment or add a new one
                </p>
              </div>

              {loadingProjects ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={() => setShowAddProject(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add New Repository
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {projects.map((project) => (
                    <Card
                      key={project.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedProject === project.id
                          ? "ring-2 ring-primary"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedProject(project.id);
                        setSelectedBranch(project.branch_name);
                      }}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                          <Github className="h-5 w-5 mt-1 text-muted-foreground" />
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">{project.name}</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              {project.description || "No description provided"}
                            </p>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-medium">Branch: {project.branch_name}</span>
                              <Badge variant="secondary">Ready for deployment</Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  </div>
                </>
              )}

              <AddProjectModal
                open={showAddProject}
                onOpenChange={setShowAddProject}
                onProjectAdded={fetchProjects}
              />
            </div>
          )}

          {/* Step 2: Configure Infrastructure */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Configure Infrastructure</h2>
                <p className="text-muted-foreground">
                  Describe your infrastructure needs and AWS services
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3 block">
                    Describe Your Infrastructure Needs
                  </label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="E.g., I need a serverless API with DynamoDB for storing user data and S3 for file uploads..."
                    className="min-h-[200px] resize-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">
                    Quick Add AWS Services
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AWS_SERVICES.map((service) => (
                      <Badge
                        key={service}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => addServiceTag(service)}
                      >
                        + {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review & Deploy */}
          {step === 3 && aiResponse && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Review & Deploy</h2>
                <p className="text-muted-foreground">
                  Review the generated configuration and apply changes
                </p>
              </div>

              <Tabs defaultValue="sstConfig" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="sstConfig">SST Config</TabsTrigger>
                  <TabsTrigger value="suggestedChanges">Implementation Guide</TabsTrigger>
                  <TabsTrigger value="iamPolicy">IAM Policy</TabsTrigger>
                </TabsList>

                <TabsContent value="sstConfig" className="mt-6">
                  <Card>
                    <CardContent className="p-6">
                      <pre className="text-sm overflow-x-auto whitespace-pre-wrap font-mono">
                        {aiResponse.sstConfig}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="suggestedChanges" className="mt-6">
                  <Card>
                    <CardContent className="p-6">
                      <pre className="text-sm overflow-x-auto whitespace-pre-wrap font-mono">
                        {aiResponse.suggestedChanges}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="iamPolicy" className="mt-6">
                  <Card>
                    <CardContent className="p-6">
                      <pre className="text-sm overflow-x-auto whitespace-pre-wrap font-mono">
                        {aiResponse.iamPolicy}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <Card className="bg-accent/50">
                <CardContent className="p-6">
                  <p className="text-sm font-medium mb-2">Review & Modify</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Want to make changes? Go back to edit your prompt or add additional instructions.
                  </p>
                  <Textarea
                    placeholder="Add additional instructions here..."
                    className="min-h-[100px] resize-none"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-8 mt-8 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={loading}
              size="lg"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {step === 1 ? "Back to Dashboard" : "Back"}
            </Button>

            {step < 3 ? (
              <Button onClick={handleNext} disabled={loading} size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Next Step"
                )}
              </Button>
            ) : (
              <Button onClick={handleApply} size="lg">
                Apply Configuration
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
