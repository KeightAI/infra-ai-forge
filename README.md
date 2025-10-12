# Jate AI

## Project info

**URL**: https://jate.lovable.app/

Welcome to Jate AI.
This projects goal is to ease the deployment of serverless apps to cloud infrastructure.

Main Functionality
Jate AI is an intelligent deployment platform that simplifies the process of deploying serverless applications to AWS infrastructure. It combines AI-powered configuration generation with automated deployment workflows to help developers deploy GitHub repositories without deep infrastructure knowledge.

## Core Features
### 1. GitHub Repository Integration

Connect and manage multiple GitHub repositories

Support for public and private repositories

Branch-specific deployment configuration

Centralized project dashboard for all repositories

### 2. AI-Powered Infrastructure Configuration

Interactive AI chat interface using Dust.tt for generating SST (Serverless Stack Toolkit) configurations

Natural language processing to understand infrastructure requirements

Generates three key outputs:

SST Configuration (TypeScript)
 - Infrastructure-as-code files
 - Implementation Guide (Markdown)
 - Step-by-step deployment instructions

IAM Policy (JSON) suggestions

Conversational refinement - iterate on configurations through follow-up questions

Quick-add AWS service tags (Lambda, API Gateway, DynamoDB, S3, etc.)

### 3. Deployment Wizard

Two-step guided workflow:
Step 1: Select GitHub repository
Step 2: Chat with AI to generate and refine configurations
Copy-to-clipboard functionality for all generated code
Real-time configuration generation and updates

### 4. Automated Deployment Worker

Background worker service (Fly.io) that polls for deployment jobs
Automated pipeline:
Clones repository from GitHub
Installs dependencies
Deploys to AWS using SST CLI
Updates deployment status in real-time
Support for multiple deployment stages (production, staging, etc.)
Handles both deployments and removals
### 5. Project Management

Dashboard for viewing all connected projects
Deploy, delete, and manage multiple projects
Track deployment status and history
Project metadata (name, description, branch, deployment URL)
Technology Stack
Frontend: React, TypeScript, Tailwind CSS, shadcn/ui
Backend: Supabase (database, authentication, edge functions)
AI: Dust.tt AI agent for configuration generation
Deployment: SST (Serverless Stack) framework for AWS
Worker: Node.js/Express deployment worker on Fly.io
Authentication: GitHub OAuth
User Journey
Sign in with GitHub account
Add GitHub repository to the platform
Use Deployment Wizard to describe infrastructure needs in natural language
AI generates production-ready SST configurations, implementation guides, and IAM policies
Review, copy, and apply configurations to your repository
Click "Deploy" to trigger automated deployment to AWS
Background worker handles the entire deployment process
Monitor deployment status from the dashboard
Key Value Propositions
No Infrastructure Expertise Required: AI translates plain English requirements into production-ready configurations
Rapid Prototyping: Go from repository to deployed AWS infrastructure in minutes
Best Practices Built-In: AI generates configurations following AWS and SST best practices
Iterative Refinement: Chat interface allows you to refine configurations through conversation
Automated Deployments: Set-it-and-forget-it deployment pipeline with status tracking

## Build Information

### Step 1: Clone the repo

### Step 2: Install the necessary dependencies.
`npm install`

### Step 3: Start the development server with auto-reloading and an instant preview.
`npm run dev`

## Usage Notes

Log into the app using your GitHub Account

Add the repository to the app that you want to deploy.

Use the Deployment Wizard to chat with AI and let it generate configuration files and deployment instructions catered to your needs.
Once you followed all the instructions your app is ready to be deployed.
Click on the Deploy Button to let our worker machines take care of your deployment.
