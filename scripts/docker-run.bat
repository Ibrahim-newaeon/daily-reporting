@echo off
REM Docker Desktop run script for Daily Reports (Windows)
REM Usage: scripts\docker-run.bat [command]

setlocal enabledelayedexpansion

set COMPOSE_FILE=docker-compose.local.yml
set PROJECT_NAME=daily-reports

if "%1"=="" goto start
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="build" goto build
if "%1"=="rebuild" goto rebuild
if "%1"=="logs" goto logs
if "%1"=="status" goto status
if "%1"=="clean" goto clean
goto help

:start
echo ==^> Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop first.
    exit /b 1
)
if not exist ".env" (
    echo Warning: .env file not found. Creating from .env.example...
    copy .env.example .env
    echo Please edit .env file with your credentials before running again.
    exit /b 1
)
echo ==^> Starting Daily Reports...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% up -d
echo ==^> Application starting at http://localhost:3030
echo ==^> Use 'scripts\docker-run.bat logs' to view logs
goto end

:stop
echo ==^> Stopping Daily Reports...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% down
echo ==^> Application stopped
goto end

:build
echo ==^> Building Daily Reports...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% build --no-cache
echo ==^> Build complete
goto end

:rebuild
echo ==^> Rebuilding and starting Daily Reports...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% up -d --build
echo ==^> Application running at http://localhost:3030
goto end

:logs
echo ==^> Showing logs (Ctrl+C to exit)...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% logs -f
goto end

:status
echo ==^> Container status:
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% ps
goto end

:clean
echo Warning: This will remove all containers and volumes!
set /p CONFIRM=Are you sure? (y/N):
if /i "!CONFIRM!"=="y" (
    echo ==^> Cleaning up...
    docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% down -v --rmi local
    echo ==^> Cleanup complete
)
goto end

:help
echo Daily Reports - Docker Desktop Runner
echo.
echo Usage: %0 [command]
echo.
echo Commands:
echo   start    Start the application (default)
echo   stop     Stop the application
echo   build    Build the Docker image
echo   rebuild  Rebuild and start the application
echo   logs     View application logs
echo   status   Show container status
echo   clean    Remove containers and volumes
goto end

:end
endlocal
