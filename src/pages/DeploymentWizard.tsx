import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Github, Plus, Copy, Check, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AddProjectModal } from "@/components/AddProjectModal";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Project {
  id: string;
  name: string;
  github_repo_url: string | null;
  branch_name: string;
  description: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  codeBlocks?: Array<{
    type: 'sstConfig' | 'suggestedChanges' | 'iamPolicy' | 'generic';
    code: string;
    language: string;
    label: string;
  }>;
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
    title: "Configure & Chat with AI",
    subtitle: "Describe and refine your deployment needs"
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
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showAddProject, setShowAddProject] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

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

  const handleSendMessage = async () => {
    if (!currentInput.trim() || currentInput.trim().length < 10) {
      toast({
        title: "Invalid Input",
        description: "Please provide a more detailed description (at least 10 characters)",
        variant: "destructive",
      });
      return;
    }

    if (!selectedProjectData) {
      toast({
        title: "No Project Selected",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentInput("");
    setIsGenerating(true);

    try {
      const conversationContext = chatMessages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');
      
      const fullPrompt = conversationContext 
        ? `${conversationContext}\n\nUser: ${userMessage.content}`
        : userMessage.content;

      const { data, error } = await supabase.functions.invoke('generate-sst-config', {
        body: {
          prompt: fullPrompt,
          projectName: selectedProjectData.name,
          repository: selectedProjectData.github_repo_url,
        }
      });

      if (error) throw error;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.suggestedChanges || "Here's your configuration:",
        timestamp: new Date(),
        codeBlocks: [
          {
            type: 'sstConfig',
            code: data.sstConfig,
            language: 'typescript',
            label: 'SST Config'
          },
          {
            type: 'suggestedChanges',
            code: data.suggestedChanges,
            language: 'markdown',
            label: 'Implementation Guide'
          },
          {
            type: 'iamPolicy',
            code: data.iamPolicy,
            language: 'json',
            label: 'IAM Policy'
          }
        ]
      };

      setChatMessages(prev => [...prev, assistantMessage]);
      
      toast({
        title: "Configuration Generated",
        description: "Your SST configuration is ready",
      });
    } catch (error) {
      console.error('Error generating configuration:', error);
      toast({
        title: "Error",
        description: "Failed to generate configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedProject) {
        toast({
          title: "No Project Selected",
          description: "Please select a project to continue",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/dashboard');
    }
  };

  const handleApply = () => {
    toast({
      title: "Deployment initiated",
      description: "Your SST configuration is being applied"
    });
    navigate("/dashboard");
  };

  const addServiceTag = (service: string) => {
    setCurrentInput(prev => prev + (prev ? " " : "") + service);
  };

  const handleCopy = async (content: string, section: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSection(section);
      toast({
        title: "Copied to clipboard",
        description: `${section} has been copied successfully`
      });
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive"
      });
    }
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

          {/* Step 2: Configure & Chat with AI */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Configure & Chat with AI</h2>
                <p className="text-muted-foreground">
                  Describe your infrastructure needs and refine with AI assistance
                </p>
              </div>

              <div className="space-y-6">
                <ScrollArea className="h-[500px] w-full rounded-lg border p-4">
                  <div className="space-y-4">
                    {chatMessages.length === 0 && (
                      <div className="flex items-center justify-center h-[450px] text-muted-foreground">
                        <p>Describe your infrastructure needs, and I'll help you generate the SST configuration</p>
                      </div>
                    )}
                    
                    {chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'} rounded-lg p-4`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          
                          {message.codeBlocks && message.codeBlocks.length > 0 && (
                            <div className="mt-4 space-y-4">
                              {message.codeBlocks.map((block, idx) => (
                                <Card key={idx} className="bg-[#1e1e1e] border-none">
                                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm text-[#d4d4d4]">{block.label}</CardTitle>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCopy(block.code, block.label)}
                                      className="h-8 w-8 p-0"
                                    >
                                      {copiedSection === block.label ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <Copy className="h-4 w-4 text-[#d4d4d4]" />
                                      )}
                                    </Button>
                                  </CardHeader>
                                  <CardContent>
                                    <pre className="text-xs text-[#d4d4d4] overflow-x-auto">
                                      <code>{block.code}</code>
                                    </pre>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {isGenerating && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg p-4">
                          <p className="text-sm text-muted-foreground">Generating configuration...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">Quick add:</span>
                    {AWS_SERVICES.map(service => (
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

                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Describe your infrastructure or ask for refinements..."
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      className="min-h-[100px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={isGenerating || !currentInput.trim()}
                      className="self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              {step === 1 ? "Back to Dashboard" : "Back"}
            </Button>
            
            {step === 1 && (
              <Button onClick={handleNext} disabled={!selectedProject}>
                Next Step
              </Button>
            )}
            
            {step === 2 && chatMessages.length > 0 && (
              <Button onClick={handleApply}>
                Apply Configuration
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
