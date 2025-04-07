import { createGithubIssue } from '../github/issue-creator.js';

export function logRequest(context, message, data = {}) {
  console.log(`📝 ${message}:`, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}

export function logError(context = {}, error, message = 'Error occurred', extraData = {}) {
  if (!error) {
    log(50, 'logError called with null or undefined error object', context, extraData);
    return;
  }

  const logData = {
    ...context,
    ...extraData,
    error: {
      message: error.message,
      name: error.name,
      code: error.code, // Include error code if available (e.g., AppError)
      status: error.status, // Include status if available
      // Only include stack in non-production environments or if explicitly enabled
      stack: process.env.NODE_ENV !== 'production' || process.env.LOG_STACK_TRACE === 'true' ? error.stack?.split('\n').map(s => s.trim()) : undefined,
      details: error.details // Include details if it's an AppError
    }
  };

  log(50, message, logData);

  // GitHub Issue Creation (non-blocking)
  if (process.env.ENABLE_GITHUB_ISSUE_REPORTING === 'true') {
    const combinedContext = {
      ...(context || {}),
      ...(extraData || {}),
    };
    // Use setImmediate or similar to avoid blocking the current execution thread
    setImmediate(() => {
        try {
            // Ensure we pass a proper Error object
            const errorToReport = (error instanceof Error) ? error : new Error(JSON.stringify(error || 'Unknown Error'));
            createGithubIssue(errorToReport, combinedContext);
        } catch (githubErr) {
            console.error('Error invoking createGithubIssue:', githubErr);
        }
    });
  }
}

export function logPubSub(context, message, data = {}) {
  console.log(`📨 ${message}:`, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}

export function logProcessing(context, message, data = {}) {
  console.log(`⚙️ ${message}:`, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}

export function logAuth(context, message, data = {}) {
  console.log(`🔒 ${message}:`, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}