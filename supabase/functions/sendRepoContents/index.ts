// supabase/functions/github-to-weaviate/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { walk } from 'https://deno.land/std@0.168.0/fs/walk.ts';
const WEAVIATE_URL = Deno.env.get('WEAVIATE_URL') || 'http://localhost:8080';
const WEAVIATE_API_KEY = Deno.env.get('WEAVIATE_API_KEY');
// Clone GitHub repository
async function cloneRepository(repoUrl, branch = 'main', githubToken) {
    const tempDir = await Deno.makeTempDir();
    console.log(`Cloning ${repoUrl} to ${tempDir}`);
    // Add GitHub token to URL if available (for private repos)
    let cloneUrl = repoUrl;
    if (githubToken && repoUrl.includes('github.com')) {
        cloneUrl = repoUrl.replace('https://', `https://${githubToken}@`);
    }
    const command = new Deno.Command('git', {
        args: [
            'clone',
            '--depth',
            '1',
            '--branch',
            branch,
            cloneUrl,
            tempDir
        ],
        stdout: 'piped',
        stderr: 'piped'
    });
    const { code, stdout, stderr } = await command.output();
    if (code !== 0) {
        const errorText = new TextDecoder().decode(stderr);
        throw new Error(`Git clone failed: ${errorText}`);
    }
    console.log('Repository cloned successfully');
    return tempDir;
}
// Read all files from directory
async function readAllFiles(dir, repoUrl, branch) {
    const files = [];
    const textExtensions = new Set([
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.py',
        '.java',
        '.go',
        '.rs',
        '.c',
        '.cpp',
        '.h',
        '.css',
        '.scss',
        '.html',
        '.vue',
        '.svelte',
        '.json',
        '.yaml',
        '.yml',
        '.toml',
        '.md',
        '.txt',
        '.sh',
        '.bash',
        '.env',
        '.gitignore',
        '.sql',
        '.graphql',
        '.xml',
        '.csv',
        '.rb',
        '.php',
        '.swift',
        '.kt',
        '.scala',
        '.r',
        '.m',
        '.cs'
    ]);
    const ignorePatterns = [
        '.git',
        'node_modules',
        'dist',
        'build',
        '.next',
        '.cache',
        'coverage',
        '__pycache__',
        '.pytest_cache',
        'vendor',
        'target'
    ];
    for await (const entry of walk(dir, {
        includeDirs: false,
        skip: ignorePatterns.map((p)=>new RegExp(p))
    })){
        const relativePath = entry.path.replace(dir, '').replace(/^\//, '');
        const extension = entry.name.includes('.') ? '.' + entry.name.split('.').pop().toLowerCase() : '';
        // Only process text files
        if (!textExtensions.has(extension) && extension !== '') {
            continue;
        }
        try {
            const content = await Deno.readTextFile(entry.path);
            const stats = await Deno.stat(entry.path);
            files.push({
                path: relativePath,
                content: content,
                extension: extension,
                size: stats.size,
                repository: repoUrl,
                branch: branch
            });
            console.log(`Read file: ${relativePath} (${stats.size} bytes)`);
        } catch (error) {
            console.error(`Failed to read ${relativePath}:`, error);
        }
    }
    return files;
}
// Create Weaviate schema if it doesn't exist
async function ensureWeaviateSchema() {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (WEAVIATE_API_KEY) {
        headers['Authorization'] = `Bearer ${WEAVIATE_API_KEY}`;
    }
    // Check if schema exists
    const checkResponse = await fetch(`${WEAVIATE_URL}/v1/schema/CodeFile`, {
        headers
    });
    if (checkResponse.status === 404) {
        // Create schema
        console.log('Creating Weaviate schema...');
        const schema = {
            class: 'CodeFile',
            description: 'A file from a GitHub repository',
            vectorizer: 'text2vec-openai',
            moduleConfig: {
                'text2vec-openai': {
                    model: 'ada',
                    modelVersion: '002',
                    type: 'text'
                }
            },
            properties: [
                {
                    name: 'path',
                    dataType: [
                        'text'
                    ],
                    description: 'File path in repository'
                },
                {
                    name: 'content',
                    dataType: [
                        'text'
                    ],
                    description: 'File content'
                },
                {
                    name: 'extension',
                    dataType: [
                        'text'
                    ],
                    description: 'File extension'
                },
                {
                    name: 'size',
                    dataType: [
                        'int'
                    ],
                    description: 'File size in bytes'
                },
                {
                    name: 'repository',
                    dataType: [
                        'text'
                    ],
                    description: 'GitHub repository URL'
                },
                {
                    name: 'branch',
                    dataType: [
                        'text'
                    ],
                    description: 'Git branch'
                }
            ]
        };
        const createResponse = await fetch(`${WEAVIATE_URL}/v1/schema`, {
            method: 'POST',
            headers,
            body: JSON.stringify(schema)
        });
        if (!createResponse.ok) {
            throw new Error(`Failed to create schema: ${await createResponse.text()}`);
        }
        console.log('Schema created successfully');
    } else {
        console.log('Schema already exists');
    }
}
// Upload files to Weaviate
async function uploadToWeaviate(files) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (WEAVIATE_API_KEY) {
        headers['Authorization'] = `Bearer ${WEAVIATE_API_KEY}`;
    }
    console.log(`Uploading ${files.length} files to Weaviate...`);
    // Batch upload for better performance
    const batchSize = 100;
    for(let i = 0; i < files.length; i += batchSize){
        const batch = files.slice(i, i + batchSize);
        const objects = batch.map((file)=>({
            class: 'CodeFile',
            properties: file
        }));
        const response = await fetch(`${WEAVIATE_URL}/v1/batch/objects`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                objects
            })
        });
        if (!response.ok) {
            const error = await response.text();
            console.error(`Batch upload failed: ${error}`);
            throw new Error(`Failed to upload batch: ${error}`);
        }
        console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}`);
    }
    console.log('All files uploaded successfully');
}
// Cleanup temporary directory
async function cleanup(dir) {
    try {
        await Deno.remove(dir, {
            recursive: true
        });
        console.log(`Cleaned up ${dir}`);
    } catch (error) {
        console.error(`Failed to cleanup ${dir}:`, error);
    }
}
serve(async (req)=>{
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
            }
        });
    }
    let tempDir = null;
    try {
        const { github_url, branch = 'main', github_token } = await req.json();
        if (!github_url) {
            return new Response(JSON.stringify({
                error: 'github_url is required'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        console.log(`Processing repository: ${github_url} (branch: ${branch})`);
        // Ensure Weaviate schema exists
        await ensureWeaviateSchema();
        // Clone repository with user's GitHub token
        tempDir = await cloneRepository(github_url, branch, github_token);
        // Read all files
        const files = await readAllFiles(tempDir, github_url, branch);
        if (files.length === 0) {
            return new Response(JSON.stringify({
                error: 'No supported files found in repository',
                message: 'Repository may be empty or contain only binary files'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        // Upload to Weaviate
        await uploadToWeaviate(files);
        return new Response(JSON.stringify({
            success: true,
            message: `Successfully indexed ${files.length} files`,
            repository: github_url,
            branch: branch,
            files_processed: files.length
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } finally{
        // Cleanup
        if (tempDir) {
            await cleanup(tempDir);
        }
    }
});
