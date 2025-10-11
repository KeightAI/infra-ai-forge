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
      `https://dust.tt/api/v1/w/${workspaceId}/apps/${appId}/runs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DUST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          specification_hash: null,
          config: {
            blocks: [
              {
                type: "input",
                name: "prompt",
                value: `Project: ${projectName}\nRepository: ${repository}\n\n${prompt}`
              }
            ]
          },
          blocking: true,
          stream: false
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

    // Parse the response from Dust.tt
    // The actual structure may vary based on your Dust.tt app configuration
    const result = {
      sstConfig: data.run?.results?.[0]?.value?.sstConfig || "// SST configuration will appear here",
      suggestedChanges: data.run?.results?.[0]?.value?.suggestedChanges || "# Implementation guide will appear here",
      iamPolicy: data.run?.results?.[0]?.value?.iamPolicy || "{}"
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
