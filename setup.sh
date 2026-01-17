#!/usr/bin/env bash

# YoPago Setup Script
# This script helps set up the YoPago development environment

set -e

echo "🚀 YoPago Development Environment Setup"
echo "========================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting."; exit 1; }

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "ℹ️  .env file already exists"
fi
echo ""

# Check if backend should be built
echo "🔨 Backend Setup"
read -p "Do you want to build the backend now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Building backend..."
    cd backend
    if command -v mvn >/dev/null 2>&1; then
        mvn clean package -DskipTests
        echo "✅ Backend built successfully"
    else
        echo "⚠️  Maven not installed. Skipping backend build."
        echo "   You can build it later with: cd backend && mvn clean package"
    fi
    cd ..
else
    echo "⏭️  Skipping backend build"
fi
echo ""

# Check if mobile dependencies should be installed
echo "📱 Mobile App Setup"
read -p "Do you want to install mobile app dependencies now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing mobile dependencies..."
    cd mobile
    if command -v npm >/dev/null 2>&1; then
        npm install
        echo "✅ Mobile dependencies installed"
    else
        echo "⚠️  npm not installed. Skipping mobile setup."
        echo "   You can install dependencies later with: cd mobile && npm install"
    fi
    cd ..
else
    echo "⏭️  Skipping mobile setup"
fi
echo ""

# Ask about starting services
echo "🐳 Docker Services"
read -p "Do you want to start all services now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting services..."
    docker-compose up -d
    echo ""
    echo "✅ Services are starting up"
    echo ""
    echo "⏳ Waiting for services to be ready (this may take a minute)..."
    sleep 10
    
    echo ""
    echo "📊 Service Status:"
    docker-compose ps
else
    echo "⏭️  Skipping service startup"
fi
echo ""

echo "✅ Setup Complete!"
echo ""
echo "🎯 Next Steps:"
echo "1. Review and update .env file if needed"
echo "2. Start services: make up (or docker-compose up -d)"
echo "3. Access services:"
echo "   - API: http://localhost:8080"
echo "   - Keycloak: http://localhost:8180 (admin/admin)"
echo "   - PostgreSQL: localhost:5432"
echo ""
echo "4. View logs: make logs (or docker-compose logs -f)"
echo ""
echo "📚 For more information, see README.md"
echo ""
echo "Happy coding! 🎉"
