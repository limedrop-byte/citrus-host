#!/bin/bash

# Print commands and exit on errors
set -ex

echo "🚀 Starting deployment process..."

# Update code from repository
echo "📥 Fetching latest code..."
git fetch
git reset --hard origin/main

# Build backend
echo "🔧 Building backend..."
cd backend
npm ci  # Use npm ci instead of npm install for more reliable installs
npm run build

# Build frontend
echo "🎨 Building frontend..."
cd ../frontend
npm ci  # Use npm ci instead of npm install for more reliable installs

# Build the frontend
npm run build

# Restart services
echo "🔄 Restarting services..."
cd ..
pm2 restart all

echo "✅ Deployment completed successfully!" 