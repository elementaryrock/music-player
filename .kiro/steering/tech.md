# Technology Stack

## Core Technologies
- **Frontend Framework**: React 19.0.0 with TypeScript 5.7.2
- **Build Tool**: Vite 6.2.0 with Hot Module Replacement (HMR)
- **Package Manager**: npm (uses package-lock.json)
- **Module System**: ES Modules (type: "module")

## Key Dependencies
- **UI Libraries**: 
  - phosphor-react (icons)
  - react-icons (additional icons)
  - react-lrc (lyric display)
- **Development Tools**:
  - ESLint 9.21.0 with TypeScript support
  - @vitejs/plugin-react for Fast Refresh

## Build & Development Commands

```bash
# Development server with HMR
npm run dev

# Production build (TypeScript compilation + Vite build)
npm run build

# Code linting
npm run lint

# Preview production build
npm run preview
```

## Configuration Notes
- Uses strict TypeScript configuration with modern ES2020 target
- ESLint configured with React Hooks and React Refresh plugins
- Vite proxy setup for Tidal API integration with fallback endpoints
- CORS enabled for development server
- Custom headers configured for API requests