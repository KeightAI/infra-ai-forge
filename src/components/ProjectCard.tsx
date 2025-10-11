import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Rocket, Lock, Unlock } from "lucide-react";
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
  onDeploy: (id: string) => void;
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
  onDeploy
}: ProjectCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold">{name}</CardTitle>
          <Badge variant={is_private ? "secondary" : "outline"} className="ml-2">
            {is_private ? <Lock className="h-3 w-3 mr-1 text-accent" /> : <Unlock className="h-3 w-3 mr-1 text-accent" />}
            {is_private ? "Private" : "Public"}
          </Badge>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Branch:</span>
          <Badge variant="outline">{branch_name}</Badge>
        </div>
        
        {is_deployed && deployed_url && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status:</span>
            <Badge className="bg-green-500">Deployed</Badge>
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
              <ExternalLink className="h-4 w-4 mr-2 text-accent" />
              View Repo
            </a>
          </Button>
        )}
        
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