# YoPago Mobile App

React Native Expo app for YoPago shared expense tracking.

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI

## Installation

```bash
npm install
# or
yarn install
```

## Running

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## Environment Variables

Set these in your environment or in app.json:

- `API_URL` - Backend API URL (default: http://localhost:8080)
- `KEYCLOAK_URL` - Keycloak server URL (default: http://localhost:8180)
- `KEYCLOAK_REALM` - Keycloak realm name (default: yopago)
- `KEYCLOAK_CLIENT_ID` - Keycloak client ID (default: yopago-mobile)

## Features

- User authentication via Keycloak
- Create and track expenses
- View expense history
- Categorize expenses
- Split expenses with groups
