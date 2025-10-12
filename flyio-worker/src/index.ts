// src/index.ts
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const app = express();
app.use(express.json());

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000'); // 30 seconds default
const PORT = process.env.PORT || 8080;

// Initialize Supabase client with proper service role configuration
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

interface DeploymentJob {
  id: string;
  github_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'toBeRemoved';
  branch?: string;
  stage?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// Update job status in database
async function updateJobStatus(
  jobId: string,
  status: DeploymentJob['status'],
  errorMessage?: string
) {
  const { error } = await supabase
    .from('deployments')
    .update({
      status,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error(`Failed to update job ${jobId}:`, error);
  }
}

// Execute shell command and log output
function executeCommand(command: string, cwd?: string): string {
  try {
    console.log(`Executing: ${command}`);
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: {
        ...process.env,
        // Ensure AWS credentials are available
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      },
    });
    console.log(output);
    return output;
  } catch (error: any) {
    console.error(`Command failed: ${command}`);
    console.error(error.stdout?.toString());
    console.error(error.stderr?.toString());
    throw new Error(error.stderr?.toString() || error.message);
  }
}

// Clone repository and deploy/remove using SST
async function processRepository(job: DeploymentJob) {
  let repoDir: string | null = null;
  const isRemoval = job.status === 'toBeRemoved';

  try {
    console.log(`Starting ${isRemoval ? 'removal' : 'deployment'} for job ${job.id}: ${job.github_url}`);

    // Create temporary directory
    repoDir = mkdtempSync(join(tmpdir(), 'repo-'));
    console.log(`Created temp directory: ${repoDir}`);

    // Clone the repository
    const branch = job.branch || 'main';
    const cloneCommand = `git clone --depth 1 --branch ${branch} ${job.github_url} ${repoDir}`;
    executeCommand(cloneCommand);

    // Install dependencies
    console.log('Installing dependencies...');
    executeCommand('npm install', repoDir);

    // Check if sst is installed locally, if not install globally
    try {
      executeCommand('npx sst version', repoDir);
    } catch {
      console.log('SST not found, installing...');
      executeCommand('npm install -g sst', repoDir);
    }

    // Deploy or remove using SST
    const stage = job.stage || 'production';
    const command = isRemoval ? 'remove' : 'deploy';
    console.log(`Running sst ${command} for stage: ${stage}`);
    const output = executeCommand(`npx sst ${command} --stage ${stage}`, repoDir);

    // Update job as completed
    await updateJobStatus(job.id, 'completed');

    console.log(`Successfully ${isRemoval ? 'removed' : 'deployed'} job ${job.id}`);
    return output;
  } catch (error: any) {
    console.error(`${isRemoval ? 'Removal' : 'Deployment'} failed for job ${job.id}:`, error.message);
    await updateJobStatus(job.id, 'failed', error.message);
    throw error;
  } finally {
    // Cleanup: Remove temporary directory
    if (repoDir) {
      try {
        rmSync(repoDir, { recursive: true, force: true });
        console.log(`Cleaned up temp directory: ${repoDir}`);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp directory:', cleanupError);
      }
    }
  }
}

// Poll database for pending jobs and removals
async function pollForJobs() {
  try {
    const { data: jobs_2 } = await supabase
      .from('deployments')
      .select('*');

      console.log(jobs_2);

    console.log('Polling for pending jobs and removals...');

    const { data: jobs, error } = await supabase
      .from('deployments')
      .select('*')
      .in('status', ['pending', 'toBeRemoved'])
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('Error fetching jobs:', error);
      return;
    }

    console.log(jobs);

    if (!jobs || jobs.length === 0) {
      console.log('No pending jobs or removals found');
      return;
    }

    const job = jobs[0] as DeploymentJob;
    console.log(`Found job: ${job.id} with status: ${job.status}`);

    // Update status to processing
    await updateJobStatus(job.id, 'processing');

    // Process the deployment or removal
    await processRepository(job);
  } catch (error) {
    console.error('Error in polling cycle:', error);
  }
}

// Start polling
let pollingInterval: NodeJS.Timeout;

function startPolling() {
  console.log(`Starting polling with interval: ${POLL_INTERVAL}ms`);
  pollingInterval = setInterval(pollForJobs, POLL_INTERVAL);
  // Run immediately on start
  pollForJobs();
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    console.log('Polling stopped');
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', polling: !!pollingInterval });
});

// Manual trigger endpoint (optional)
app.post('/trigger', async (req, res) => {
  try {
    await pollForJobs();
    res.json({ success: true, message: 'Job polling triggered' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start server and polling
app.listen(PORT, () => {
  console.log(`Deployment worker running on port ${PORT}`);
  startPolling();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  stopPolling();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  stopPolling();
  process.exit(0);
});