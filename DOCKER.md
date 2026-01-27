# Running Daily Reports with Docker Desktop

This guide explains how to run the Daily Reports application locally using Docker Desktop.

## Prerequisites

1. **Docker Desktop** installed and running
   - [Download for Windows](https://docs.docker.com/desktop/install/windows-install/)
   - [Download for Mac](https://docs.docker.com/desktop/install/mac-install/)
   - [Download for Linux](https://docs.docker.com/desktop/install/linux-install/)

2. **Git** (to clone the repository)

---

## Option 1: Using Docker Desktop GUI (Recommended for Beginners)

### Step 1: Open Docker Desktop

Launch Docker Desktop from your applications. Wait until the Docker icon shows "Docker Desktop is running".

![Docker Desktop Running](https://docs.docker.com/desktop/images/docker-app-dashboard.webp)

### Step 2: Open Terminal in Docker Desktop

1. Click on **"Dev Environments"** in the left sidebar (or use the built-in terminal)
2. Or click the **search bar** at the top and type `>terminal` then press Enter
3. Or go to: **View → Terminal** (keyboard shortcut: `` Ctrl+` `` on Windows/Linux, `` Cmd+` `` on Mac)

### Step 3: Navigate to Project Folder

In the Docker Desktop terminal:

```bash
# Navigate to where you downloaded the project
cd /path/to/daily-reporting

# Example paths:
# Windows: cd /c/Users/YourName/Projects/daily-reporting
# Mac: cd /Users/YourName/Projects/daily-reporting
# Linux: cd /home/yourname/projects/daily-reporting
```

### Step 4: Setup Environment

```bash
# Copy environment template
cp .env.example .env
```

Then edit `.env` file with your Firebase credentials (use any text editor).

### Step 5: Build and Run

```bash
# Build and start containers
docker-compose -f docker-compose.local.yml up -d --build
```

### Step 6: View Running Containers

1. Click **"Containers"** in Docker Desktop sidebar
2. You should see:
   - `daily-reports-local` (the app) - Status: Running
   - `daily-reports-redis` (cache) - Status: Running

### Step 7: Access the App

1. In Docker Desktop, click on `daily-reports-local` container
2. Click the **"Open in Browser"** button (or the port `3030:3030` link)
3. Or manually open: **http://localhost:3030**

### Step 8: View Logs

1. Click on `daily-reports-local` container in Docker Desktop
2. Click the **"Logs"** tab to see application output

### Step 9: Stop the App

1. In Docker Desktop **Containers** view
2. Click the **Stop** button (square icon) next to the container group
3. Or select containers and click **Delete** to remove them

---

## Option 2: Using Docker Desktop Terminal

### Open Integrated Terminal

**Method 1 - Keyboard Shortcut:**
- Windows/Linux: Press `` Ctrl+` ``
- Mac: Press `` Cmd+` ``

**Method 2 - Menu:**
- Go to **View** → **Terminal**

**Method 3 - Search:**
- Click the search bar at top
- Type `>terminal`
- Press Enter

### Run Commands

Once terminal is open:

```bash
# Navigate to project
cd /path/to/daily-reporting

# Setup (first time only)
cp .env.example .env

# Start the app
docker-compose -f docker-compose.local.yml up -d --build

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Stop the app
docker-compose -f docker-compose.local.yml down
```

---

## Option 3: Command Line Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Ibrahim-newaeon/daily-reporting.git
cd daily-reporting
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your credentials
# Required: Firebase configuration
# Optional: Platform OAuth credentials (Google, Meta, LinkedIn, TikTok, Snapchat)
```

### 3. Start the Application

**macOS/Linux:**
```bash
./scripts/docker-run.sh start
```

**Windows:**
```cmd
scripts\docker-run.bat start
```

**Or use Docker Compose directly:**
```bash
docker-compose -f docker-compose.local.yml up -d
```

### 4. Access the Application

Open your browser and navigate to:
```
http://localhost:3030
```

---

## Docker Desktop GUI Quick Reference

| Task | How To |
|------|--------|
| **Open Terminal** | `Ctrl+`` (Windows/Linux) or `Cmd+`` (Mac) |
| **View Containers** | Click "Containers" in left sidebar |
| **Start Container** | Click ▶️ play button on container row |
| **Stop Container** | Click ⏹️ stop button on container row |
| **View Logs** | Click container name → "Logs" tab |
| **Open in Browser** | Click port number (e.g., `3030:3030`) |
| **Container Terminal** | Click container → "Terminal" tab |
| **Delete Container** | Hover container → Click 🗑️ trash icon |
| **View Files** | Click container → "Files" tab |
| **Check Resources** | Click container → View CPU/Memory graphs |

---

## Script Commands

| Command | Description |
|---------|-------------|
| `start` | Start the application (default) |
| `stop` | Stop the application |
| `build` | Build the Docker image |
| `rebuild` | Rebuild and start the application |
| `logs` | View application logs |
| `status` | Show container status |
| `clean` | Remove containers and volumes |

## Configuration

### Required Environment Variables

```env
# Firebase Configuration (from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Security (generate these!)
NEXTAUTH_SECRET=your-secret-min-32-chars
TOKEN_ENCRYPTION_KEY=your-64-char-hex-key
```

### Generate Security Keys

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate TOKEN_ENCRYPTION_KEY
openssl rand -hex 32
```

### Optional: Platform OAuth

To connect marketing platforms, add OAuth credentials:

```env
# Google (GA4, Google Ads)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxx

# Meta (Facebook, Instagram)
NEXT_PUBLIC_META_APP_ID=xxx
META_APP_SECRET=xxx

# LinkedIn
LINKEDIN_CLIENT_ID=xxx
LINKEDIN_CLIENT_SECRET=xxx

# TikTok
TIKTOK_APP_ID=xxx
TIKTOK_APP_SECRET=xxx

# Snapchat
SNAP_CLIENT_ID=xxx
SNAP_CLIENT_SECRET=xxx
```

## Architecture

The Docker setup includes:

```
┌─────────────────────────────────────────┐
│              Docker Network             │
│                                         │
│  ┌─────────────┐    ┌───────────────┐  │
│  │   Next.js   │───▶│     Redis     │  │
│  │  App:3030   │    │    :6379      │  │
│  └─────────────┘    └───────────────┘  │
│         │                              │
└─────────┼──────────────────────────────┘
          │
          ▼
    http://localhost:3030
```

- **Next.js App**: The main application (port 3030)
- **Redis**: Caching and rate limiting (port 6379)

## Troubleshooting

### Docker not running

```
Error: Docker is not running. Please start Docker Desktop first.
```

**Solution:** Open Docker Desktop and wait for it to fully start.

### Port already in use

```
Error: Bind for 0.0.0.0:3030 failed: port is already allocated
```

**Solution:** Stop the service using port 3030, or change the port in `docker-compose.local.yml`:
```yaml
ports:
  - "3031:3030"  # Use port 3031 instead
```

### Build fails

```bash
# Clean rebuild
./scripts/docker-run.sh clean
./scripts/docker-run.sh rebuild
```

### View logs for debugging

```bash
./scripts/docker-run.sh logs
```

### Container won't start

Check the health endpoint:
```bash
docker-compose -f docker-compose.local.yml logs app
```

## Development vs Production

| Feature | Local (docker-compose.local.yml) | Production (docker-compose.yml) |
|---------|----------------------------------|----------------------------------|
| Redis memory | 64MB | 128MB |
| Health check interval | 30s | 30s |
| Logging | Default | JSON with rotation |
| Environment | Simplified | Full configuration |

## PWA Support

The application is a Progressive Web App. When accessing via browser:

1. **Chrome/Edge**: Look for the install icon in the address bar
2. **Safari (iOS)**: Tap Share → Add to Home Screen
3. **Android**: Browser will prompt to install

Once installed, the app runs in standalone mode without browser UI.

## Stopping the Application

```bash
./scripts/docker-run.sh stop
```

Or to completely remove containers and data:
```bash
./scripts/docker-run.sh clean
```
