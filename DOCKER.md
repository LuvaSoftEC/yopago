# Docker Deployment Guide

This guide explains how to deploy YoPago using Docker and Docker Compose.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

## Quick Start

```bash
# Copy environment variables
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

## Service Ports

- **API**: 8080
- **Keycloak**: 8180
- **PostgreSQL**: 5432

## Building Images

### Backend API

```bash
# Build the JAR file
cd backend
mvn clean package

# Build Docker image
docker build -t yopago-api:latest .
```

### Mobile App (for web deployment)

The mobile app uses Expo which is primarily for mobile development. For web deployment:

```bash
cd mobile
npm install
npm run web
```

## Service Dependencies

Services start in this order:
1. PostgreSQL (database)
2. Keycloak (depends on PostgreSQL)
3. API (depends on PostgreSQL and Keycloak)

## Health Checks

All services include health checks:

```bash
# Check API health
curl http://localhost:8080/actuator/health

# Check Keycloak health
curl http://localhost:8180/health/ready

# Check PostgreSQL
docker-compose exec postgres pg_isready -U yopago
```

## Volumes

Persistent data is stored in Docker volumes:

- `postgres_data`: Database files

To remove volumes (⚠️ this will delete all data):

```bash
docker-compose down -v
```

## Networks

All services communicate on the `yopago-network` bridge network.

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs

# Check specific service
docker-compose logs api
docker-compose logs keycloak
docker-compose logs postgres
```

### Port conflicts

If ports are already in use, modify them in docker-compose.yml:

```yaml
services:
  postgres:
    ports:
      - "5433:5432"  # Change host port
```

### Database connection issues

```bash
# Check if PostgreSQL is ready
docker-compose exec postgres pg_isready -U yopago

# Connect to database
docker-compose exec postgres psql -U yopago yopago
```

### Keycloak not accessible

Wait 1-2 minutes after startup for Keycloak to initialize. Check logs:

```bash
docker-compose logs keycloak
```

## Production Considerations

For production deployment with Docker:

1. **Use external database**: Configure managed PostgreSQL (RDS, Cloud SQL)
2. **Use secrets**: Store secrets in Docker secrets or external vault
3. **Use reverse proxy**: Add nginx or traefik for SSL termination
4. **Configure logging**: Use log drivers to send logs to central system
5. **Set resource limits**: Configure memory and CPU limits
6. **Use image tags**: Use specific version tags, not `latest`
7. **Enable TLS**: Configure HTTPS for all services
8. **Backup data**: Set up automated backups for volumes

### Example Production docker-compose.yml additions

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Updating Services

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build

# Or restart individual service
docker-compose restart api
```

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (⚠️ deletes data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```
