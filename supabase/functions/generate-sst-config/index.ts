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
          specification_hash: "b12f55a404ded71e63fdfe150ffa0bac1622efb5f50666932a32333de88585f6",
          config: {
            "ANALYER": {
              "provider_id": "openai",
              "model_id": "gpt-4o-mini"
            }
          },
          blocking: true,
          inputs: [{
            prompt: `Project: ${projectName}\nRepository: ${repository}\n\n${prompt}`
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
    const result = {
      sstConfig: data.run?.results?.[0]?.[0]?.value || "// No SST configuration generated",
      suggestedChanges: data.run?.results?.[0]?.[0]?.value || "# No implementation guide generated",
      iamPolicy: data.run?.results?.[0]?.[0]?.value || "{}"
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
