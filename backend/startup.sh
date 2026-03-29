#!/bin/bash

echo ""
echo "=========================================="
echo "  Orbisporte Backend API Server"
echo "=========================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo ""
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit .env and configure your database connection!"
    echo ""
    read -p "Press enter to continue..."
fi

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt
echo ""

# Start the server
echo "Starting Orbisporte API server..."
echo "API will be available at: http://localhost:8000"
echo "Documentation: http://localhost:8000/docs"
echo ""
uvicorn Orbisporte.interfaces.api.main:app --reload --host 0.0.0.0 --port 8000
