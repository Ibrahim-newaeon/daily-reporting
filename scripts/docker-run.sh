#!/bin/bash

# Docker Desktop run script for Daily Reports
# Usage: ./scripts/docker-run.sh [command]
#
# Commands:
#   start   - Start the application (default)
#   stop    - Stop the application
#   build   - Build/rebuild the Docker image
#   logs    - View application logs
#   shell   - Open a shell in the container
#   clean   - Remove containers and volumes

set -e

COMPOSE_FILE="docker-compose.local.yml"
PROJECT_NAME="daily-reports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}==>${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

print_error() {
    echo -e "${RED}Error:${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop first."
        exit 1
    fi
}

# Check if .env file exists
check_env() {
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your credentials before running again."
        exit 1
    fi
}

case "${1:-start}" in
    start)
        check_docker
        check_env
        print_status "Starting Daily Reports..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
        print_status "Application starting at http://localhost:3030"
        print_status "Use './scripts/docker-run.sh logs' to view logs"
        ;;

    stop)
        check_docker
        print_status "Stopping Daily Reports..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
        print_status "Application stopped"
        ;;

    build)
        check_docker
        check_env
        print_status "Building Daily Reports..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache
        print_status "Build complete"
        ;;

    rebuild)
        check_docker
        check_env
        print_status "Rebuilding and starting Daily Reports..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d --build
        print_status "Application running at http://localhost:3030"
        ;;

    logs)
        check_docker
        print_status "Showing logs (Ctrl+C to exit)..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
        ;;

    shell)
        check_docker
        print_status "Opening shell in app container..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME exec app /bin/sh
        ;;

    status)
        check_docker
        print_status "Container status:"
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
        ;;

    clean)
        check_docker
        print_warning "This will remove all containers and volumes!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Cleaning up..."
            docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down -v --rmi local
            print_status "Cleanup complete"
        fi
        ;;

    *)
        echo "Daily Reports - Docker Desktop Runner"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start    Start the application (default)"
        echo "  stop     Stop the application"
        echo "  build    Build the Docker image"
        echo "  rebuild  Rebuild and start the application"
        echo "  logs     View application logs"
        echo "  shell    Open a shell in the container"
        echo "  status   Show container status"
        echo "  clean    Remove containers and volumes"
        ;;
esac
