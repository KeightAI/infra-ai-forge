import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Rocket, Lock, Unlock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProjectCardProps {
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
  onDeploy: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ProjectCard = ({
  id,
  name,
  description,
  github_repo_url,
  branch_name,
  is_private,
  is_deployed,
  deployed_url,
  created_at,
  deployment_status,
  onDeploy,
  onDelete
}: ProjectCardProps) => {
  const getStatusBadge = () => {
    if (deployment_status === 'completed') {
      return <Badge className="bg-green-500 hover:bg-green-600">Deployed</Badge>;
    } else if (deployment_status === 'processing') {
      return <Badge className="bg-blue-500 hover:bg-blue-600">Processing</Badge>;
    } else if (deployment_status === 'pending') {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>;
    } else if (deployment_status === 'failed') {
      return <Badge className="bg-red-500 hover:bg-red-600">Failed</Badge>;
    }
    return <Badge variant="secondary">Not Deployed</Badge>;
  };
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold">{name}</CardTitle>
          <Badge variant={is_private ? "secondary" : "outline"} className="ml-2">
            {is_private ? <Lock className="h-3 w-3 mr-1 text-primary" /> : <Unlock className="h-3 w-3 mr-1 text-primary" />}
            {is_private ? "Private" : "Public"}
          </Badge>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Branch:</span>
          <Badge variant="outline">{branch_name}</Badge>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status:</span>
          {getStatusBadge()}
        </div>

        {deployed_url && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">URL:</span>
            <a 
              href={deployed_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline text-xs truncate max-w-[200px]"
            >
              {deployed_url}
            </a>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(new Date(created_at), { addSuffix: true })}
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2">
        {github_repo_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={github_repo_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2 text-primary" />
              View Repo
            </a>
          </Button>
        )}
        
        <Button 
          variant="outline"
          size="sm" 
          onClick={() => onDelete(id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
        
        <Button 
          size="sm" 
          onClick={() => onDeploy(id)}
          className="ml-auto"
        >
          <Rocket className="h-4 w-4 mr-2" />
          Deploy
        </Button>
      </CardFooter>
    </Card>
  );
};