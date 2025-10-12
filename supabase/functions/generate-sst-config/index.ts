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
    const { prompt, projectName, repository } = await req.json();
    
    const DUST_API_KEY = Deno.env.get('DUST_API_KEY');
    if (!DUST_API_KEY) {
      throw new Error('DUST_API_KEY is not configured');
    }

    const workspaceId = 'SydwFOh7Iq';
    const appId = 'CLUlCI2i24';

    console.log('Calling Dust.tt API with prompt:', prompt);

    const response = await fetch(
      `https://dust.tt/api/v1/w/${workspaceId}/spaces/vlt_ySrW39PAjHD9/apps/${appId}/runs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DUST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          specification_hash: "7550fb92da919dbb4e65e0ab502b35abc2372472c9bb046af8c4745fe93795eb",
          config: {
            "ANALYZER": {
              "provider_id": "openai",
              "model_id": "gpt-4o-mini"
            }
          },
          blocking: true,
          inputs: [{
            repoName: projectName,
            repoUrl: repository,
            prompt: prompt
          }]
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dust.tt API error:', response.status, errorText);
      throw new Error(`Dust.tt API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Dust.tt API response:', JSON.stringify(data));

    // Check if the run errored
    if (data.run?.status?.run === 'errored') {
      const errorMsg = data.run?.traces?.[0]?.[1]?.[0]?.[0]?.error || 'Unknown error from Dust.tt';
      console.error('Dust.tt run errored:', errorMsg);
      throw new Error(`Dust.tt processing failed: ${errorMsg}`);
    }

    // Parse the response from Dust.tt
    // The actual content is in data.run.results[0][0].value.message.content
    const messageContent = data.run?.results?.[0]?.[0]?.value?.message?.content;
    
    if (!messageContent) {
      console.error('No message content in response:', JSON.stringify(data.run?.results));
      throw new Error('No content returned from Dust.tt');
    }

    console.log('Message content from Dust.tt:', messageContent);

    // Parse the JSON string from message.content
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(messageContent);
    } catch (e) {
      console.error('Failed to parse message content as JSON:', e);
      throw new Error('Invalid JSON format in Dust.tt response');
    }

    // Extract the three configuration fields and replace generic names with actual project name
    const sanitizedProjectName = projectName?.replace(/[^a-zA-Z0-9]/g, '') || 'MyProject';
    const kebabProjectName = projectName?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'my-project';
    
    // Check if we have a structured response with all required fields
    if (parsedResponse.sstConfig && parsedResponse.suggestedChanges && parsedResponse.iamPolicy) {
      const result = {
        format: 'structured',
        sstConfig: (parsedResponse.sstConfig || "// No SST configuration generated")
          .replace(/UnknownRepoStack/g, `${sanitizedProjectName}Stack`)
          .replace(/unknown-repo/g, kebabProjectName),
        suggestedChanges: (parsedResponse.suggestedChanges || "# No implementation guide generated")
          .replace(/unknown-repo/g, kebabProjectName),
        iamPolicy: parsedResponse.iamPolicy || "{}"
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Treat as plaintext response and extract code blocks
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      const codeBlocks = [];
      let match;
      
      while ((match = codeBlockRegex.exec(messageContent)) !== null) {
        codeBlocks.push({
          language: match[1] || 'text',
          code: match[2].trim()
        });
      }

      const result = {
        format: 'plaintext',
        content: messageContent,
        codeBlocks: codeBlocks
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in generate-sst-config function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
