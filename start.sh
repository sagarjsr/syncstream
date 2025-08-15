#!/bin/bash

# SyncStream Application Startup Script
# This script starts both the backend server and frontend development server

set -e  # Exit on any error

echo "🚀 Starting SyncStream Application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to get local IP address
get_local_ip() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        local_ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
    else
        # Linux and others
        local_ip=$(hostname -I | awk '{print $1}')
    fi
    
    if [[ -z "$local_ip" ]]; then
        echo "localhost"
    else
        echo "$local_ip"
    fi
}

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down SyncStream...${NC}"
    if [[ ! -z $BACKEND_PID ]]; then
        echo -e "${BLUE}Stopping backend server (PID: $BACKEND_PID)${NC}"
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [[ ! -z $FRONTEND_PID ]]; then
        echo -e "${BLUE}Stopping frontend server (PID: $FRONTEND_PID)${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ SyncStream stopped successfully${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Backend directory
BACKEND_DIR="$SCRIPT_DIR/syncstream-server"
# Frontend directory  
FRONTEND_DIR="$SCRIPT_DIR/syncstream-web"

echo -e "${BLUE}📁 Script directory: $SCRIPT_DIR${NC}"

# Check if directories exist
if [[ ! -d "$BACKEND_DIR" ]]; then
    echo -e "${RED}❌ Backend directory not found: $BACKEND_DIR${NC}"
    exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
    echo -e "${RED}❌ Frontend directory not found: $FRONTEND_DIR${NC}"
    exit 1
fi

# Function to install dependencies if needed
install_dependencies() {
    echo -e "${BLUE}📦 Checking project dependencies...${NC}"
    cd "$SCRIPT_DIR"
    
    if [[ ! -d "node_modules" ]] || [[ ! -f "package-lock.json" ]]; then
        echo -e "${YELLOW}Installing project dependencies (this includes both frontend and backend)...${NC}"
        npm install
        echo -e "${GREEN}✅ All dependencies installed in shared node_modules${NC}"
    else
        echo -e "${GREEN}✅ Dependencies already installed in shared node_modules${NC}"
    fi
}

# Install project dependencies (shared node_modules)
install_dependencies

echo -e "${BLUE}🔧 Starting services...${NC}"

# Start backend server in background
echo -e "${BLUE}Starting backend server...${NC}"
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start backend server${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID) - http://localhost:3001${NC}"

# Get local IP address
LOCAL_IP=$(get_local_ip)
echo -e "${BLUE}📍 Local IP address: $LOCAL_IP${NC}"

# Create or update frontend .env file
echo -e "${BLUE}Creating frontend environment configuration...${NC}"
echo "NEXT_PUBLIC_SOCKET_URL=http://$LOCAL_IP:3001" > "$FRONTEND_DIR/.env"
echo -e "${GREEN}✅ Frontend environment configured${NC}"

# Start frontend server in background
echo -e "${BLUE}Starting frontend development server...${NC}"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start frontend server${NC}"
    cleanup
    exit 1
fi

echo -e "${GREEN}✅ Frontend server started (PID: $FRONTEND_PID)${NC}"

echo ""
echo -e "${GREEN}🎉 SyncStream is now running!${NC}"
echo -e "${BLUE}🌐 Frontend (local): http://localhost:3000${NC}"
echo -e "${BLUE}🌐 Frontend (network): http://$LOCAL_IP:3000${NC}"
echo -e "${BLUE}🔗 Backend (local): http://localhost:3001${NC}"
echo -e "${BLUE}🔗 Backend (network): http://$LOCAL_IP:3001${NC}"
echo ""
echo -e "${YELLOW}📝 How to use:${NC}"
echo "1. Open http://localhost:3000 in your browser (local) or http://$LOCAL_IP:3000 (from other devices)"
echo "2. Create a room or join an existing one"
echo "3. Share the room link with others to watch together"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"

# Wait for user interrupt
wait $BACKEND_PID $FRONTEND_PID
