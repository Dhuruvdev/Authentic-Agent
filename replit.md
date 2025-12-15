# NothingHide - Digital Identity Exposure Analysis

## Overview

NothingHide is a cybersecurity application that identifies where a user's digital identity is publicly exposed using only lawful, transparent methods. The system accepts email addresses, usernames, or image URLs and performs exposure analysis through a modular chain of specialized modules.

**Core constraints:**
- No dark web access or private database queries
- No password collection or processing
- Only public APIs and lawful data sources
- Full transparency about what was and wasn't checked

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with path aliases (`@/` for client source, `@shared/` for shared types)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: Server-Sent Events (SSE) for real-time scan progress streaming
- **Module System**: Chain of specialized modules that process input sequentially:
  - `NH-Signal`: Input classification (email, username, image_url)
  - `NH-Breach`: Breach intelligence via HaveIBeenPwned API
  - `NH-Correlate`: Username presence checking across platforms
  - `NH-FaceRisk`: Image exposure analysis
  - `NH-Verdict`: Risk scoring and assessment
  - `NH-Guidance`: Actionable recommendations
  - `NH-Transparency`: Full disclosure of methods used

### Data Storage
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Location**: `shared/schema.ts` contains all type definitions and Zod schemas
- **Current State**: In-memory storage implementation exists (`MemStorage`), database can be provisioned via `DATABASE_URL`

### Key Design Patterns
- **Shared Types**: Zod schemas in `shared/schema.ts` provide runtime validation and TypeScript types
- **SSE Streaming**: Scan results stream in real-time as each module completes
- **Progressive Disclosure**: Results show what was checked and explicitly what was NOT checked
- **Modular Analysis**: Each analysis module operates independently and can fail gracefully

## External Dependencies

### Required API Keys (Optional but recommended)
- `HIBP_API_KEY`: HaveIBeenPwned API for breach detection (without it, breach checking is disabled with clear messaging)

### Database
- PostgreSQL via `DATABASE_URL` environment variable
- Drizzle Kit for migrations (`npm run db:push`)

### Third-Party Services
- HaveIBeenPwned API for breach intelligence
- Platform HTTP checks for username correlation (GitHub, Twitter, Instagram, Reddit, etc.)

### Build & Development
- Vite for frontend bundling
- esbuild for server bundling
- tsx for TypeScript execution in development