# Implementation Plan: Automatic GitHub Issue Creation for Backend Errors

This document outlines the plan to implement a feature that automatically creates GitHub issues for errors encountered in the backend application.

## 1. Goal

Automatically report backend errors as GitHub issues in the `nifyacorp/backend` repository to improve error tracking and visibility. Issues should include error details and context.

## 2. Prerequisites

*   **Secrets:**
    *   `GITHUB_TOKEN`: A GitHub token with `read:issues` and `write:issues` permissions available in the Secret Manager.
    *   `GITHUB_OWNER`: The GitHub organization/user name (`nifyacorp`) available in the Secret Manager.
*   **Environment Variables:**
    *   `GITHUB_REPO`: The repository name (`backend`) set as an environment variable in the deployment environment (e.g., Cloud Run).
    *   `SERVICE_NAME`: (Optional but recommended) The Cloud Run service name (or equivalent identifier) to help construct log links.
    *   `SERVICE_REGION`: (Optional but recommended) The Cloud Run region (or equivalent) to help construct log links.
    *   `ENABLE_GITHUB_ISSUE_REPORTING`: (Optional, default `false`) A flag to enable/disable this feature.

## 3. Implementation Steps

1.  **Add Dependency:**
    *   Install the official GitHub client library:
        ```bash
        npm install @octokit/rest
        # or
        yarn add @octokit/rest
        ```
    *   Add `@octokit/rest` to `package.json`.

2.  **Create GitHub Utility:**
    *   Create a new file: `src/shared/github/issue-creator.js`.
    *   This module will be responsible for:
        *   Initializing the Octokit client using the `GITHUB_TOKEN`.
        *   Retrieving `GITHUB_OWNER` and `GITHUB_REPO` from environment variables/secrets.
        *   Providing a function `createGithubIssue(error, context)` that takes the error object and context information.
        *   Constructing the issue title (e.g., `Backend Error: ${error.message.substring(0, 50)}...`).
        *   Constructing the issue body, including:
            *   Full error message (`error.message`).
            *   Stack trace (`error.stack`).
            *   Context information passed to `logError` (e.g., `requestId`, `path`, `method`, `service`, custom details).
            *   Timestamp.
            *   (Optional) A link to Cloud Run logs using `SERVICE_NAME`, `SERVICE_REGION`, and timestamp if available.
            *   Environment details (e.g., `NODE_ENV`).
        *   Calling the GitHub API (`octokit.rest.issues.create`) to create the issue.
        *   Implementing basic error handling for the API call itself (log failures, don't crash the app).
        *   (Optional) Implementing a simple in-memory cache (e.g., using a Map with timestamps) to prevent creating duplicate issues for the exact same error within a short timeframe (e.g., 5 minutes). A hash of the error message + stack trace could serve as a key.

3.  **Integrate with Logging:**
    *   Locate the central `logError` function (likely in `src/shared/logging/logger.js`).
    *   Import the `createGithubIssue` function from `src/shared/github/issue-creator.js`.
    *   Inside `logError`, after the existing logging logic:
        *   Check if `ENABLE_GITHUB_ISSUE_REPORTING` is enabled.
        *   If enabled, call `createGithubIssue(error, context)` asynchronously (don't `await` it directly in the logging path to avoid blocking). Wrap the call in a `try...catch` to prevent GitHub API errors from disrupting logging.

4.  **Configuration & Environment:**
    *   Ensure the necessary environment variables (`GITHUB_REPO`, `SERVICE_NAME`, `SERVICE_REGION`, `ENABLE_GITHUB_ISSUE_REPORTING`) and secrets (`GITHUB_TOKEN`, `GITHUB_OWNER`) are properly configured in the deployment environment (e.g., Cloud Run service definition).
    *   Update deployment scripts or configurations if necessary.

5.  **Testing:**
    *   Add unit tests for `src/shared/github/issue-creator.js` (mocking the Octokit client).
    *   Manually trigger or simulate an error in a development/staging environment with the feature enabled to verify an issue is created correctly in the target GitHub repository.
    *   Verify that disabling the feature via `ENABLE_GITHUB_ISSUE_REPORTING` prevents issue creation.
    *   Test edge cases (e.g., GitHub API unavailable, invalid token).

## 4. Considerations

*   **Rate Limiting:** Be mindful of GitHub API rate limits. The duplicate prevention mechanism helps, but high error rates could still hit limits.
*   **Security:** Ensure the `GITHUB_TOKEN` is handled securely via Secret Manager and not exposed in logs or source code.
*   **Noise:** Fine-tune which errors trigger issue creation if necessary. Some expected or low-priority errors might not warrant a GitHub issue. This could involve adding flags/levels to `logError` or filtering within the `issue-creator`.
*   **Cloud Run Log Link:** Constructing an accurate, clickable Cloud Run log link can be complex. It might require querying GCP metadata or relying on specific log formats. Start simple (e.g., just providing service/region/timestamp) and enhance later if needed. 