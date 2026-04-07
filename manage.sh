#!/bin/bash
# ============================================
# Orbisporte Docker Management Script
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to copy .env file if it doesn't exist
setup_env() {
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Created .env file from template. Please edit it with your configuration."
        else
            print_error ".env.example not found. Cannot create .env file."
            exit 1
        fi
    fi
    print_success "Environment configuration found"
}

# Function to build Docker images
build() {
    print_status "Building Docker images..."
    docker-compose build --parallel
    print_success "Docker images built successfully"
}

# Function to start all services
start() {
    check_docker
    setup_env
    
    print_status "Starting Orbisporte services..."
    docker-compose up -d
    
    print_success ""
    print_success "╔═══════════════════════════════════════════════════════════╗"
    print_success "║         Orbisporte is now running!                       ║"
    print_success "╠═══════════════════════════════════════════════════════════╣"
    print_success "║  Frontend:  http://localhost:3000                       ║"
    print_success "║  Backend:   http://localhost:8000                       ║"
    print_success "║  API Docs:  http://localhost:8000/docs                 ║"
    print_success "╚═══════════════════════════════════════════════════════════╝"
    print_success ""
    
    # Show status
    status
}

# Function to stop all services
stop() {
    print_status "Stopping Orbisporte services..."
    docker-compose down
    print_success "Services stopped"
}

# Function to restart services
restart() {
    stop
    start
}

# Function to show service status
status() {
    print_status "Service Status:"
    docker-compose ps
}

# Function to view logs
logs() {
    SERVICE=${1:-}
    if [ -z "$SERVICE" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$SERVICE"
    fi
}

# Function to clean up everything
clean() {
    print_warning "This will remove all containers, volumes, and images!"
    read -p "Are you sure? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" = "yes" ]; then
        print_status "Cleaning up..."
        docker-compose down -v --remove-orphans
        docker system prune -f
        print_success "Cleanup complete"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show help
help() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           Orbisporte Docker Management Script             ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo "║  Usage: ./manage.sh <command>                             ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo "║  Commands:                                               ║"
    echo "║    start     - Start all services                        ║"
    echo "║    stop      - Stop all services                         ║"
    echo "║    restart   - Restart all services                       ║"
    echo "║    build     - Build Docker images                       ║"
    echo "║    status    - Show service status                        ║"
    echo "║    logs      - View logs (all services)                  ║"
    echo "║    logs <svc>- View logs for specific service            ║"
    echo "║    clean     - Remove all containers and volumes         ║"
    echo "║    help      - Show this help message                    ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo "║  Services:                                               ║"
    echo "║    backend   - FastAPI backend                           ║"
    echo "║    frontend  - React frontend (nginx)                    ║"
    echo "║    postgres  - PostgreSQL database                        ║"
    echo "║    redis     - Redis cache                               ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
}

# Main script
case "${1:-help}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    build)
        check_docker
        setup_env
        build
        ;;
    status)
        status
        ;;
    logs)
        logs "$2"
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        help
        ;;
    *)
        print_error "Unknown command: $1"
        help
        exit 1
        ;;
esac
