# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Backend Service Guidelines

## Build Commands
- **Start**: `npm start` (production), `npm run dev` (development with nodemon)
- **Database**: `npm run migrations` (run migrations)
- **Documentation**: `npm run docs:generate` (generate API docs), `npm run docs:serve` (serve docs)
- **Testing**: `node test-subscription-api.js` (subscription API), `node test-notifications.js USER_ID` (notifications)
- **Single tests**: `NODE_ENV=development node [test-file.js]` with optional `AUTH_TOKEN=token` and `USER_ID=id`

## Code Style Guidelines
- **Architecture**: Domain-driven design with core/infrastructure/interfaces layers
- **Naming**: PascalCase (classes), camelCase (functions/variables), snake_case (DB fields)
- **Error Handling**: Use AppError with code, status, message; try/catch for async code
- **Logging**: Include context with requestId, path; different log types with emoji distinction
- **Imports**: External first, then internal; use relative paths within modules
- **Asynchronous**: Use async/await; proper error propagation; avoid callback nesting
- **Database**: Use parameterized queries; set RLS context; use transactions for multi-step operations
- **API**: Follow RESTful design; consistent response format with status and data

## Authentication Requirements
- JWT-based authentication with `Bearer token` format (space after Bearer)
- Include `x-user-id` header with user's ID in all authenticated requests
- Use `verifyAuthHeaders()` utility before making authenticated requests

## Service Architecture
- Repository pattern with service/data implementations and fallback mechanisms
- Singleton service pattern with clear business logic separation
- Defensive schema checking and validation using Zod
- PubSub for asynchronous event handling
- Error resilience with graceful degradation
- NEVER use mock data; let errors appear for proper debugging