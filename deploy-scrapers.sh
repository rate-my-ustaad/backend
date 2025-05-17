#!/bin/bash

# Script to deploy all scrapers one by one
# Usage: ./deploy-scrapers.sh [optional: specific scraper name]

set -e  # Exit on error

# Base directory for scrapers
SCRAPERS_DIR="$(dirname "$0")/scrapers"

# Check if we're in the right directory
if [ ! -d "$SCRAPERS_DIR" ]; then
  echo "Error: scrapers directory not found."
  echo "Please run this script from the infra-core root directory."
  exit 1
fi

# Function to deploy a single scraper
deploy_scraper() {
  local scraper_name=$1
  local scraper_dir="${SCRAPERS_DIR}/${scraper_name}"
  
  if [ ! -d "$scraper_dir" ]; then
    echo "❌ Scraper directory not found: $scraper_name"
    return 1
  fi
  
  echo "📦 Deploying scraper: $scraper_name"
  
  # Navigate to scraper directory
  cd "$scraper_dir"
  
  # Check if package.json exists
  if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in $scraper_name"
    return 1
  fi
  
  # Install dependencies if node_modules doesn't exist
  if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies for $scraper_name..."
    npm install
  fi
  
  # Deploy using Wrangler
  echo "🚀 Deploying $scraper_name to Cloudflare Workers..."
  npm run deploy
  
  # Return to original directory
  cd - > /dev/null
  
  echo "✅ Successfully deployed $scraper_name"
  echo "--------------------------------------"
}

# Main script logic
if [ $# -eq 0 ]; then
  # No arguments provided, deploy all scrapers
  echo "🔄 Deploying all scrapers"
  echo "--------------------------------------"
  
  # Get all scraper directories
  scrapers=($(ls -d "$SCRAPERS_DIR"/*/ | xargs -n 1 basename))
  
  # Loop through each scraper and deploy
  for scraper in "${scrapers[@]}"; do
    deploy_scraper "$scraper"
  done
  
  echo "🎉 All scrapers deployed successfully!"
else
  # Deploy specific scraper
  deploy_scraper "$1"
fi