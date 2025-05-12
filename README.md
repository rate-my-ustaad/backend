# infra-core

Backend infrastructure for the RateMyUstaad application. This repository contains all server-side components and services.

## Overview

This repository houses various backend services used by the RateMyUstaad application, including:

- **Cloudflare Workers**: Serverless functions that power our API endpoints
  - `censorship` - Content moderation service using AI to filter inappropriate reviews

## Services

### Censorship Service

A Cloudflare Worker that uses AI to automatically moderate and filter user-submitted reviews. The service analyzes review content to ensure it follows community guidelines and doesn't contain inappropriate language.

## Development

Each service has its own directory with specific setup instructions. Refer to the README.md file in each service directory for detailed information.

## Deployment

Services are deployed using local deployment commands and auth. Configuration is managed through Wrangler for Cloudflare Workers.
