# Architecture Overview

## System Architecture

YoPago follows a microservices architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                     Users/Clients                        │
└────────────┬────────────────────────────┬────────────────┘
             │                            │
             │                            │
     ┌───────▼─────────┐         ┌────────▼───────────┐
     │  Mobile App     │         │   Future Web App   │
     │ (React Native)  │         │     (React)        │
     └───────┬─────────┘         └────────┬───────────┘
             │                            │
             │          OAuth2/OIDC       │
             │                            │
             └──────────┬─────────────────┘
                        │
                ┌───────▼────────┐
                │   Keycloak     │
                │ (Identity IDP) │
                └───────┬────────┘
                        │ Issues JWT
                        │
                ┌───────▼────────┐
                │  Spring Boot   │
                │   REST API     │
                └───────┬────────┘
                        │
                ┌───────▼────────┐
                │  PostgreSQL    │
                │   Database     │
                └────────────────┘
```

## Component Details

### 1. Spring Boot API

**Technology Stack:**
- Spring Boot 3.2
- Spring Security with OAuth2 Resource Server
- Spring Data JPA
- PostgreSQL Driver
- Flyway for migrations
- Lombok for boilerplate reduction

**Responsibilities:**
- RESTful API endpoints
- JWT token validation
- Business logic
- Data persistence
- Database migrations

**Key Packages:**
- `controller`: REST endpoints
- `service`: Business logic
- `repository`: Data access
- `model`: JPA entities
- `config`: Security and application configuration

### 2. React Native Mobile App

**Technology Stack:**
- React Native 0.73
- Expo SDK 50
- React Navigation
- React Native Paper (UI)
- Axios (HTTP client)

**Responsibilities:**
- User interface
- OAuth2 authentication flow
- API communication
- Local state management

**Key Directories:**
- `screens`: UI screens
- `components`: Reusable UI components
- `services`: API client and utilities

### 3. Keycloak

**Technology Stack:**
- Keycloak 23.0
- PostgreSQL backend

**Responsibilities:**
- User authentication
- OAuth2/OIDC provider
- JWT token issuance
- User management
- Password reset
- Brute force protection

**Features:**
- Multiple client configurations (API, mobile, web)
- Role-based access control
- Social login support (extensible)

### 4. PostgreSQL Database

**Technology Stack:**
- PostgreSQL 15
- Alpine Linux base

**Schema:**
- `expense_groups`: Expense group definitions
- `expenses`: Individual expense records

**Features:**
- Relational integrity
- Indexes for performance
- Sample data for development

## Data Flow

### 1. User Authentication Flow

```
User → Mobile App → Keycloak (Login)
                        ↓
                  Issues JWT Token
                        ↓
Mobile App ← JWT Token ← Keycloak
     ↓
Stores token securely
```

### 2. API Request Flow

```
Mobile App → API Request + JWT
                ↓
        Spring Security Filter
                ↓
        Validate JWT with Keycloak
                ↓
        Extract user info
                ↓
        Controller → Service → Repository
                              ↓
                         PostgreSQL
                              ↓
                         Response
                              ↓
                       Mobile App
```

## Security Architecture

### Authentication & Authorization

1. **OAuth2/OIDC Flow:**
   - Authorization Code with PKCE
   - JWT tokens (access + refresh)
   - Token validation via JWK Set

2. **API Security:**
   - Stateless authentication
   - JWT validation on every request
   - User context extraction from token

3. **Database Security:**
   - Connection credentials via environment variables
   - No hardcoded secrets
   - Prepared statements (SQL injection prevention)

### Network Security

**Local Development:**
```
Mobile App ────┐
               ├──> yopago-network (Bridge)
API ───────────┤
               │
Keycloak ──────┤
               │
PostgreSQL ────┘
```

**Production (Kubernetes):**
```
Internet
   │
   ├─> Ingress Controller (TLS)
   │      │
   │      ├─> API Service (ClusterIP)
   │      │      └─> API Pods
   │      │
   │      └─> Keycloak Service (ClusterIP)
   │             └─> Keycloak Pods
   │
   └─> PostgreSQL Service (ClusterIP)
          └─> PostgreSQL Pod
```

## Deployment Architecture

### Local Development (Docker Compose)

- Single host
- Shared network
- Local volumes
- Port forwarding

### Production (Kubernetes)

- Multi-node cluster
- Services for discovery
- Persistent volumes
- Ingress for external access
- ConfigMaps for configuration
- Secrets for credentials
- Horizontal pod autoscaling
- Rolling updates

## Scalability Considerations

### Horizontal Scaling

1. **API:**
   - Stateless design
   - Can scale to multiple replicas
   - Load balanced via Service

2. **Keycloak:**
   - Can run multiple instances
   - Shared PostgreSQL backend
   - Session replication

3. **Database:**
   - Single instance for simplicity
   - Can use managed service (RDS, Cloud SQL)
   - Read replicas for scaling reads

### Vertical Scaling

- Kubernetes resource limits
- Memory and CPU allocation
- JVM heap size tuning

## Monitoring & Observability

### Health Checks

- API: `/actuator/health`
- Keycloak: `/health/ready`, `/health/live`
- PostgreSQL: `pg_isready`

### Metrics

- Spring Boot Actuator metrics
- JVM metrics
- Custom business metrics

### Logging

- Structured logging (JSON)
- Centralized log aggregation
- Log levels per component

## Future Enhancements

1. **Web Application:**
   - React web app
   - Same API and authentication

2. **Caching Layer:**
   - Redis for session caching
   - Reduce database load

3. **Message Queue:**
   - RabbitMQ or Kafka
   - Async processing
   - Event-driven architecture

4. **API Gateway:**
   - Kong or AWS API Gateway
   - Rate limiting
   - API versioning

5. **Observability:**
   - Prometheus for metrics
   - Grafana for dashboards
   - Jaeger for distributed tracing
   - ELK stack for logs

## Technology Decisions

### Why Spring Boot?

- Mature ecosystem
- Strong security features
- Easy OAuth2 integration
- Production-ready (Actuator)
- Wide industry adoption

### Why React Native?

- Cross-platform (iOS, Android, Web)
- Large community
- Hot reload for development
- Native performance
- Reusable components

### Why Keycloak?

- Open source
- Standards compliant (OAuth2, OIDC)
- Feature rich
- Easy integration
- Self-hosted option

### Why PostgreSQL?

- Reliable and mature
- ACID compliance
- Strong data integrity
- Wide tooling support
- Cloud-native options

### Why Kubernetes?

- Industry standard
- Declarative configuration
- Self-healing
- Horizontal scaling
- Portable across clouds
