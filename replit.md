# Overview

This is an AI-powered eyeglass frame recommendation application that analyzes facial features to suggest the perfect frames for users. The system captures user photos, uses AI analysis to determine face shape and features, then provides personalized frame recommendations from a curated database. Built as a full-stack web application with a React frontend and Express.js backend.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript and Vite for fast development and building
- **UI Library**: Shadcn/ui components built on Radix UI primitives for accessible, customizable components
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **State Management**: TanStack Query for server state management and data fetching
- **Routing**: Wouter for lightweight client-side routing
- **Camera Integration**: Native browser MediaDevices API for photo capture with fallback to file upload

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **File Upload**: Multer middleware for handling image uploads with memory storage
- **API Design**: RESTful endpoints with proper error handling and request logging
- **Development**: Hot reload with Vite integration for seamless full-stack development

## Data Storage
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations and schema management
- **Schema**: Three main entities - users, frames, and analysis results
- **Migrations**: Drizzle Kit for database schema versioning and deployment

## AI Integration
- **AI Provider**: Google Gemini AI for facial feature analysis
- **Image Processing**: Base64 encoding for image transmission to AI service
- **Analysis Output**: Structured JSON responses with face shape, size recommendations, color suggestions, and confidence scores
- **Prompt Engineering**: Specialized system prompts for optical styling expertise

## Authentication & Session Management
- **Session Storage**: PostgreSQL-based session storage with connect-pg-simple
- **Session Tracking**: UUID-based session identification for analysis continuity
- **Security**: Environment variable configuration for sensitive API keys and database credentials

## External Dependencies
- **Database**: Neon PostgreSQL serverless database
- **AI Service**: Google Gemini AI API for facial analysis
- **Image Storage**: In-memory processing (no persistent image storage)
- **Fonts**: Google Fonts integration for typography
- **Development**: Replit-specific tooling for cloud development environment