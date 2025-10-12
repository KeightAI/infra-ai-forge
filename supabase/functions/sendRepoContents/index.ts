import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Support both old (github_url) and new (repoFullName) parameter formats
    const repoFullName = body.repoFullName || body.github_url;
    const branch = body.branch;
    const githubToken = body.githubToken || body.github_token;
    
    if (!repoFullName || !githubToken) {
      throw new Error('Missing required parameters: repoFullName/github_url and githubToken/github_token');
    }

    const branchName = branch || 'main';
    
    console.log('Fetching repository contents for:', repoFullName, 'branch:', branchName);

    // Fetch repository tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/trees/${branchName}?recursive=1`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Supabase-Edge-Function'
        }
      }
    );

    if (!treeResponse.ok) {
      const errorText = await treeResponse.text();
      console.error('GitHub API error:', treeResponse.status, errorText);
      throw new Error(`Failed to fetch repository tree: ${treeResponse.status}`);
    }

    const treeData = await treeResponse.json();
    console.log('Found files:', treeData.tree?.length || 0);

    // Filter for relevant files (code files, config files, etc.)
    const relevantExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml',
      '.css', '.scss', '.html', '.txt', '.env.example', '.gitignore'
    ];
    
    const relevantFiles = treeData.tree.filter((item: any) => {
      if (item.type !== 'blob') return false;
      const path = item.path.toLowerCase();
      
      // Exclude certain directories
      if (path.includes('node_modules/') || 
          path.includes('.git/') || 
          path.includes('dist/') ||
          path.includes('build/')) {
        return false;
      }
      
      return relevantExtensions.some(ext => path.endsWith(ext));
    }).slice(0, 100); // Limit to 100 files

    console.log('Relevant files to fetch:', relevantFiles.length);

    // Fetch content for each file
    const filesWithContent = await Promise.all(
      relevantFiles.map(async (file: any) => {
        try {
          const contentResponse = await fetch(
            `https://api.github.com/repos/${repoFullName}/contents/${file.path}?ref=${branchName}`,
            {
              headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Supabase-Edge-Function'
              }
            }
          );

          if (!contentResponse.ok) {
            console.error(`Failed to fetch ${file.path}:`, contentResponse.status);
            return null;
          }

          const contentData = await contentResponse.json();
          
          // Decode base64 content
          const content = contentData.content 
            ? atob(contentData.content.replace(/\n/g, ''))
            : '';

          return {
            path: file.path,
            content: content,
            size: file.size
          };
        } catch (error) {
          console.error(`Error fetching ${file.path}:`, error);
          return null;
        }
      })
    );

    // Filter out null values (failed fetches)
    const validFiles = filesWithContent.filter(f => f !== null);

    console.log('Successfully fetched contents:', validFiles.length);

    const result = {
      repository: repoFullName,
      branch: branchName,
      filesCount: validFiles.length,
      files: validFiles,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in sendRepoContents function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
