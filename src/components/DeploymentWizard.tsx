import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { z } from "zod";

interface Project {
  id: string;
  name: string;
  github_repo_url: string | null;
  branch_name: string;
}

interface DeploymentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
}

const AWS_SERVICES = [
  "Lambda", "API Gateway", "DynamoDB", "S3", "RDS", 
  "SQS", "SNS", "EventBridge", "Step Functions", "CloudFront"
];

const promptSchema = z.object({
  prompt: z.string()
    .trim()
    .min(10, { message: "Please provide more details (at least 10 characters)" })
    .max(2000, { message: "Prompt must be less than 2000 characters" })
});

export const DeploymentWizard = ({ open, onOpenChange, projects }: DeploymentWizardProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [refining, setRefining] = useState(false);
  const [aiResponse, setAiResponse] = useState<{
    sstConfig: string;
    suggestedChanges: string;
    iamPolicy: string;
  } | null>(null);

  const selectedProjectData = projects.find(p => p.id === selectedProject);

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
      // Validate prompt input
      const validation = promptSchema.safeParse({ prompt });
      if (!validation.success) {
        toast({
          title: "Invalid input",
          description: validation.error.errors[0].message,
          variant: "destructive"
        });
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-sst-config', {
          body: {
            prompt: validation.data.prompt,
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
    setStep(Math.max(1, step - 1));
  };

  const handleApply = async () => {
    toast({
      title: "Deployment initiated",
      description: "Your SST configuration is being applied"
    });
    onOpenChange(false);
    // Reset state
    setStep(1);
    setSelectedProject("");
    setPrompt("");
    setAiResponse(null);
  };

  const addServiceTag = (service: string) => {
    setPrompt(prev => prev + (prev ? " " : "") + service);
  };

  const handleRefine = async () => {
    if (!additionalInstructions.trim()) {
      toast({
        title: "Enter additional instructions",
        description: "Please provide instructions to refine the configuration",
        variant: "destructive"
      });
      return;
    }

    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-sst-config', {
        body: {
          prompt: `${prompt}\n\nAdditional instructions: ${additionalInstructions}`,
          projectName: selectedProjectData?.name,
          repository: selectedProjectData?.github_repo_url
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAiResponse(data);
      setAdditionalInstructions("");
      
      toast({
        title: "Configuration refined",
        description: "The configuration has been updated with your additional instructions"
      });
    } catch (error: any) {
      toast({
        title: "Error refining configuration",
        description: error.message || "Failed to refine configuration",
        variant: "destructive"
      });
    } finally {
      setRefining(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deployment Wizard - Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Repository</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a repository" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProject && selectedProjectData && (
              <div>
                <label className="text-sm font-medium mb-2 block">Branch</label>
                <Select 
                  value={selectedBranch} 
                  onValueChange={setSelectedBranch}
                  defaultValue={selectedProjectData.branch_name}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedProjectData.branch_name} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={selectedProjectData.branch_name}>
                      {selectedProjectData.branch_name}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Describe Your Infrastructure Needs
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., I need a serverless API with DynamoDB for storing user data and S3 for file uploads..."
                className="min-h-[150px]"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
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
        )}

        {step === 3 && aiResponse && (
          <div className="space-y-4">
            <Tabs defaultValue="sstConfig" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="sstConfig">SST Config</TabsTrigger>
                <TabsTrigger value="suggestedChanges">Implementation Guide</TabsTrigger>
                <TabsTrigger value="iamPolicy">IAM Policy</TabsTrigger>
              </TabsList>

              <TabsContent value="sstConfig" className="mt-4">
                <div className="bg-[#1e1e1e] p-4 rounded-md border-0">
                  <pre className="text-sm overflow-x-auto whitespace-pre-wrap font-mono text-[#d4d4d4]">
                    {aiResponse.sstConfig}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="suggestedChanges" className="mt-4">
                <div className="bg-[#1e1e1e] p-4 rounded-md border-0">
                  <pre className="text-sm overflow-x-auto whitespace-pre-wrap font-mono text-[#d4d4d4]">
                    {aiResponse.suggestedChanges}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="iamPolicy" className="mt-4">
                <div className="bg-[#1e1e1e] p-4 rounded-md border-0">
                  <pre className="text-sm overflow-x-auto whitespace-pre-wrap font-mono text-[#d4d4d4]">
                    {aiResponse.iamPolicy}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>

            <div className="bg-accent/50 p-4 rounded-md">
              <p className="text-sm font-medium mb-2">Refine Configuration</p>
              <p className="text-sm text-muted-foreground mb-3">
                Add additional instructions to improve the generated configuration.
              </p>
              <Textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="E.g., Add environment variables for API keys, use TypeScript instead of JavaScript..."
                className="min-h-[80px] mb-3"
              />
              <Button 
                onClick={handleRefine} 
                disabled={refining || !additionalInstructions.trim()}
                className="w-full"
              >
                {refining ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Refining...
                  </>
                ) : (
                  "Refine Configuration"
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {step < 3 ? (
            <Button onClick={handleNext} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleApply}>
              Apply Configuration
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
