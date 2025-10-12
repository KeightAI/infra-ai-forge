import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ProjectCard } from "@/components/ProjectCard";
import { AddProjectModal } from "@/components/AddProjectModal";
import { Button } from "@/components/ui/button";
import { Plus, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
  description: string | null;
  github_repo_url: string | null;
  branch_name: string;
  is_private: boolean;
  is_deployed: boolean;
  deployed_url: string | null;
  created_at: string;
  deployment_status?: string | null;
}

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const { data: projectsData, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch latest deployment status for each project
      const projectsWithStatus = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: deployment } = await supabase
            .from("deployments")
            .select("status, deployed_url")
            .eq("project_id", project.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...project,
            deployment_status: deployment?.status || null,
            deployed_url: deployment?.deployed_url || project.deployed_url,
          };
        })
      );

      setProjects(projectsWithStatus);
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

  const handleDeploy = async (projectId: string) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project || !project.github_repo_url) {
        toast({
          title: "Error",
          description: "Project not found or missing repository URL",
          variant: "destructive"
        });
        return;
      }

      // Check if deployment already exists for this project
      const { data: existingDeployment, error: checkError } = await supabase
        .from("deployments")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingDeployment) {
        toast({
          title: "Deployment already exists",
          description: "This project has already been submitted for deployment",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from("deployments")
        .insert({
          user_id: user.id,
          project_id: projectId,
          repo_url: project.github_repo_url,
          branch: project.branch_name,
          status: "pending"
        });

      if (error) throw error;

      toast({
        title: "Deployment initiated",
        description: "Your project deployment has been queued"
      });
    } catch (error: any) {
      toast({
        title: "Deployment failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (projectId: string) => {
    try {
      const project = projects.find(p => p.id === projectId);
      
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;

      toast({
        title: "Project removed",
        description: `${project?.name || "Project"} has been removed from your projects`
      });

      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error removing project",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Projects</h1>
            <p className="text-muted-foreground">
              Manage and deploy your GitHub repositories
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/deployment-wizard")}>
              <Wand2 className="mr-2 h-4 w-4" />
              Deployment Wizard
            </Button>
            <Button onClick={() => setAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          </div>
        </div>

        {loadingProjects ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground mb-4">No projects yet</p>
            <Button onClick={() => setAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4 text-primary" />
              Add Your First Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                {...project}
                onDeploy={handleDeploy}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <AddProjectModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onProjectAdded={fetchProjects}
      />
    </div>
  );
};

export default Dashboard;