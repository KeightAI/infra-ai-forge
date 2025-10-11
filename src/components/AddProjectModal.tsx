import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  default_branch: string;
}

interface AddProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectAdded: () => void;
}

export const AddProjectModal = ({ open, onOpenChange, onProjectAdded }: AddProjectModalProps) => {
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [customBranch, setCustomBranch] = useState("");
  const [showRepos, setShowRepos] = useState(false);
  const { toast } = useToast();

  const fetchGitHubRepos = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        toast({
          title: "Authentication required",
          description: "Please sign in with GitHub to access your repositories",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: {
          Authorization: `Bearer ${session.provider_token}`,
          Accept: "application/vnd.github.v3+json"
        }
      });

      if (!response.ok) throw new Error("Failed to fetch repositories");

      const data = await response.json();
      setRepos(data);
      setShowRepos(true);
    } catch (error: any) {
      toast({
        title: "Error fetching repositories",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async () => {
    if (!selectedRepo) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("projects").insert({
        user_id: user.id,
        name: selectedRepo.name,
        description: selectedRepo.description,
        github_repo_url: selectedRepo.html_url,
        github_repo_id: selectedRepo.id.toString(),
        branch_name: customBranch || selectedRepo.default_branch,
        is_private: selectedRepo.private
      });

      if (error) throw error;

      toast({
        title: "Project added",
        description: `${selectedRepo.name} has been added to your projects`
      });

      onProjectAdded();
      onOpenChange(false);
      setSelectedRepo(null);
      setCustomBranch("");
      setShowRepos(false);
    } catch (error: any) {
      toast({
        title: "Error adding project",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Project from GitHub</DialogTitle>
          <DialogDescription>
            Select a repository from your GitHub account to add as a project
          </DialogDescription>
        </DialogHeader>

        {!showRepos ? (
          <div className="space-y-4">
            <Button onClick={fetchGitHubRepos} disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />}
              Load GitHub Repositories
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedRepo ? (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h3 className="font-semibold">{selectedRepo.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedRepo.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Default branch: {selectedRepo.default_branch}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch">Branch (optional)</Label>
                  <Input
                    id="branch"
                    placeholder={selectedRepo.default_branch}
                    value={customBranch}
                    onChange={(e) => setCustomBranch(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setSelectedRepo(null)} variant="outline" className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleAddProject} disabled={loading} className="flex-1">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />}
                    Add Project
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Found {repos.length} repositories
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {repos.map((repo) => (
                    <div
                      key={repo.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedRepo(repo)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{repo.name}</h4>
                          {repo.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                        </div>
                        {repo.private && (
                          <span className="text-xs bg-secondary px-2 py-1 rounded">Private</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};