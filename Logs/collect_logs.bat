@echo off
echo Collecting runtime logs for backend service...

:: Generate a UUID for the log file using PowerShell
FOR /F "tokens=*" %%g IN ('powershell -Command "[guid]::NewGuid().ToString()"') do (SET LOG_UUID=%%g)
echo Log UUID: %LOG_UUID%

:: Create the log file with a header containing the UUID
echo ------------------------------------------------------> backend\Logs\backend_runtime_logs.txt
echo Backend Runtime Logs - Version ID: %LOG_UUID%>> backend\Logs\backend_runtime_logs.txt
echo Collected on: %date% %time%>> backend\Logs\backend_runtime_logs.txt
echo ------------------------------------------------------>> backend\Logs\backend_runtime_logs.txt
echo.>> backend\Logs\backend_runtime_logs.txt

:: Collect and append the logs
echo Collecting backend runtime logs...
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=backend AND textPayload:*" --limit=50 --format="value(textPayload)" >> backend\Logs\backend_runtime_logs.txt

echo.>> backend\Logs\backend_runtime_logs.txt
echo ------------------------------------------------------>> backend\Logs\backend_runtime_logs.txt
echo End of log collection>> backend\Logs\backend_runtime_logs.txt

echo Logs saved to backend\Logs\backend_runtime_logs.txt
echo Log collection complete with UUID: %LOG_UUID% 