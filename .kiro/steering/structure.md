# Project Structure

## Root Directory
```
music-player-ui/
├── src/                    # Source code
├── public/                 # Static assets
├── node_modules/           # Dependencies
├── dist/                   # Build output (generated)
├── package.json            # Project configuration
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript project references
├── tsconfig.app.json       # App-specific TypeScript config
├── tsconfig.node.json      # Node-specific TypeScript config
├── eslint.config.js        # ESLint configuration
└── index.html              # Entry HTML file
```

## Source Code Organization (`src/`)
```
src/
├── components/             # React components
├── hooks/                  # Custom React hooks
├── services/               # API services and external integrations
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions
├── assets/                 # Images, fonts, and other static assets
├── App.tsx                 # Main application component
├── main.tsx                # Application entry point
├── App.css                 # Main application styles
├── index.css               # Global styles
├── background.css          # Background-specific styles
├── loading.css             # Loading state styles
└── vite-env.d.ts          # Vite environment types
```

## Conventions
- **Components**: Place reusable UI components in `src/components/`
- **Business Logic**: API calls and data fetching in `src/services/`
- **Type Safety**: Define interfaces and types in `src/types/`
- **Custom Hooks**: Reusable React logic in `src/hooks/`
- **Utilities**: Pure functions and helpers in `src/utils/`
- **Styling**: Component-specific CSS co-located with components, global styles in root `src/`
- **File Extensions**: Use `.tsx` for React components, `.ts` for utilities and services