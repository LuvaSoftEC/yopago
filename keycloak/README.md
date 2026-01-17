# Keycloak Configuration for YoPago

This directory contains Keycloak realm configuration for the YoPago application.

## Realm Setup

The `yopago-realm.json` file contains the complete realm configuration including:

- **Realm**: yopago
- **Clients**:
  - `yopago-api`: Bearer-only client for the Spring Boot API
  - `yopago-mobile`: Public client for React Native mobile app
  - `yopago-web`: Public client for web applications
- **Demo User**:
  - Username: `demo`
  - Password: `demo123`
  - Email: `demo@yopago.com`

## Importing the Realm

### Using Docker Compose

The realm is automatically imported when using the provided docker-compose.yml:

```bash
docker-compose up keycloak
```

### Manual Import

1. Access Keycloak admin console at http://localhost:8180
2. Login with admin credentials
3. Click "Add realm" or select existing realm
4. Click "Import" and select `yopago-realm.json`

## Default Admin Credentials

When running with Docker Compose:
- Username: `admin`
- Password: `admin`

**⚠️ Change these credentials in production!**

## Client Details

### yopago-api (Backend API)
- Type: Bearer-only
- Purpose: Validates JWT tokens from authenticated users
- No direct user login

### yopago-mobile (Mobile App)
- Type: Public client
- Flow: Authorization Code with PKCE
- Redirect URIs: Configured for Expo development

### yopago-web (Web App)
- Type: Public client
- Flow: Authorization Code with PKCE
- Redirect URIs: Configured for web development

## Production Considerations

1. **Change default passwords**: Update admin and demo user passwords
2. **Configure SSL**: Enable SSL for production deployments
3. **Update redirect URIs**: Add production URLs to client configurations
4. **Enable brute force protection**: Already configured with reasonable defaults
5. **Review token lifespans**: Adjust based on security requirements
6. **Configure email**: Set up SMTP for password reset and email verification
