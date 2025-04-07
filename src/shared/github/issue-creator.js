import { Octokit } from '@octokit/rest';
import crypto from 'crypto';

// Simple in-memory cache to prevent duplicate issues for the same error within a short time
const recentIssuesCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let octokitInstance = null;

function getOctokit() {
  if (!octokitInstance) {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.warn('GITHUB_TOKEN environment variable not set. GitHub issue reporting disabled.');
      return null;
    }
    try {
      octokitInstance = new Octokit({ auth: githubToken });
    } catch (err) {
      console.error('Failed to initialize Octokit:', err);
      return null;
    }
  }
  return octokitInstance;
}

function generateErrorHash(error) {
  const str = `${error.message || 'No message'}:${error.stack || 'No stack'}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

function buildIssueBody(error, context) {
  const serviceName = process.env.SERVICE_NAME || 'N/A';
  const serviceRegion = process.env.SERVICE_REGION || 'N/A';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const timestamp = new Date().toISOString();

  // Basic Cloud Run log link structure (might need adjustment based on actual log setup)
  // Example assumes Cloud Logging: https://console.cloud.google.com/logs/viewer?project=[PROJECT_ID]&resource=cloud_run_revision/service_name/[SERVICE_NAME]/revision_name/[REVISION_NAME]&minLogLevel=ERROR...
  // Creating a precise link automatically is complex, so providing context is a good start.
  const cloudRunInfo = serviceName !== 'N/A'
    ? `**Cloud Run Service:** \`${serviceName}\` (${serviceRegion})`
    : '';

  return `
**🚨 Backend Error Detected 🚨**

**Timestamp:** ${timestamp}
**Environment:** ${nodeEnv}
${cloudRunInfo}

**Error Message:**
\`\`\`
${error.message || 'No message provided'}
\`\`\`

**Stack Trace:**
\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

**Context:**
\`\`\`json
${JSON.stringify(context || {}, null, 2)}
\`\`\`

---
*This issue was generated automatically by the backend error reporting system.*
  `.trim();
}

/**
 * Creates a GitHub issue for a given error.
 * Avoids creating duplicates for the same error within a short timeframe.
 *
 * @param {Error} error The error object.
 * @param {Object} [context={}] Optional context information.
 */
export async function createGithubIssue(error, context = {}) {
  const octokit = getOctokit();
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!octokit || !owner || !repo) {
    if (!process.env.GITHUB_TOKEN) return; // Already warned during init
    console.warn('GitHub owner/repo not configured. Cannot create issue.');
    return;
  }

  if (!(error instanceof Error)) {
      console.warn('Attempted to report non-Error object to GitHub:', error);
      // Optionally wrap it in an error
      error = new Error(`Non-error reported: ${JSON.stringify(error)}`);
      error.stack = ''; // No relevant stack trace
  }

  const errorHash = generateErrorHash(error);
  const now = Date.now();

  if (recentIssuesCache.has(errorHash)) {
    const lastReported = recentIssuesCache.get(errorHash);
    if (now - lastReported < CACHE_TTL_MS) {
      console.log(`Skipping duplicate GitHub issue creation for error hash: ${errorHash}`);
      return; // Don't report the same error too frequently
    }
  }

  const title = `Backend Error: ${ (error.message || 'Unknown Error').substring(0, 70) }...`;
  const body = buildIssueBody(error, context);

  try {
    console.log(`Attempting to create GitHub issue for error: ${error.message}`);
    const response = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels: ['bug', 'backend-error', `env:${process.env.NODE_ENV || 'dev'}`], // Add relevant labels
    });
    console.log(`Successfully created GitHub issue: ${response.data.html_url}`);
    recentIssuesCache.set(errorHash, now); // Update cache timestamp

    // Clean up old entries from cache occasionally (simple approach)
    if (recentIssuesCache.size > 1000) {
        for (const [key, timestamp] of recentIssuesCache.entries()) {
            if (now - timestamp > CACHE_TTL_MS) {
                recentIssuesCache.delete(key);
            }
        }
    }

  } catch (apiError) {
    console.error('Failed to create GitHub issue:', apiError.message || apiError);
    // Avoid crashing the logger or the app
  }
} 