# Backend Service Log Collection

This folder contains tools for collecting and reviewing runtime logs from the Cloud Run backend service.

## Usage Guidelines

1. **Only one log file is permitted in this folder** to prevent excessive space usage
2. Each log file contains a unique UUID to track versions
3. Run the provided script to collect fresh runtime logs

## How to Use

1. Open a terminal or PowerShell window
2. Navigate to the backend directory
3. Run `.\Logs\collect_logs.bat`
4. The script will:
   - Generate a unique UUID for the log
   - Collect the latest 50 runtime logs from the backend service
   - Save them to `Logs\backend_runtime_logs.txt`
   - Overwrite any previous log file

## Log Format

The logs are collected in reverse chronological order (newest first) and contain application runtime information such as:
- Database connections and queries
- API requests and responses
- Server events
- Schema migrations
- Error messages

## Troubleshooting

If you encounter any issues:
1. Ensure you have the Google Cloud SDK installed
2. Verify you're authenticated with `gcloud auth list`
3. Check that you have the correct project selected with `gcloud config list project` 