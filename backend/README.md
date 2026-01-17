# YoPago Backend API

Spring Boot REST API for YoPago shared expense tracking.

## Prerequisites

- Java 17+
- Maven 3.8+
- PostgreSQL 14+
- Keycloak 23+

## Building

```bash
mvn clean package
```

## Running Locally

```bash
# With Maven
mvn spring-boot:run

# With Java
java -jar target/yopago-api-0.1.0.jar
```

## Docker Build

```bash
mvn clean package
docker build -t yopago-api:latest .
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `DATABASE_USER` - Database username
- `DATABASE_PASSWORD` - Database password
- `KEYCLOAK_ISSUER_URI` - Keycloak realm issuer URI
- `KEYCLOAK_JWK_SET_URI` - Keycloak JWK set URI

## API Endpoints

### Public
- `GET /api/public/health` - Health check

### Protected (requires authentication)
- `GET /api/expenses` - List all expenses
- `GET /api/expenses/{id}` - Get expense by ID
- `GET /api/expenses/group/{groupId}` - Get expenses by group
- `GET /api/expenses/my` - Get current user's expenses
- `POST /api/expenses` - Create new expense
- `PUT /api/expenses/{id}` - Update expense
- `DELETE /api/expenses/{id}` - Delete expense
