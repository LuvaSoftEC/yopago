# YoPago - Shared Expense Tracker

YoPago is a cloud-ready platform that helps friends, roommates, and travel groups track, split, and settle shared expenses transparently. It is also an open source portfolio project built as a DevOps lab, demonstrating containerized microservices, Kubernetes, Keycloak identity, and infrastructure as code.

## 🏗️ Architecture

YoPago is built as a modern DevOps-friendly mono-repository with the following components:

- **Backend API**: Spring Boot 3.2 REST API with PostgreSQL
- **Mobile App**: React Native Expo application
- **Identity Provider**: Keycloak for OAuth2/OIDC authentication
- **Database**: PostgreSQL 15 with Flyway migrations
- **Container Orchestration**: Docker Compose for local development
- **Production Deployment**: Kubernetes manifests with Kustomize overlays

## 📁 Project Structure

```
yopago/
├── backend/                 # Spring Boot API
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/yopago/api/
│   │   │   │   ├── controller/    # REST controllers
│   │   │   │   ├── model/         # JPA entities
│   │   │   │   ├── repository/    # Data repositories
│   │   │   │   ├── service/       # Business logic
│   │   │   │   └── config/        # Security & configuration
│   │   │   └── resources/
│   │   │       ├── application.properties
│   │   │       └── db/migration/  # Flyway SQL migrations
│   │   └── test/
│   ├── pom.xml
│   ├── Dockerfile
│   └── README.md
├── mobile/                  # React Native Expo app
│   ├── src/
│   │   ├── screens/        # App screens
│   │   ├── components/     # Reusable components
│   │   └── services/       # API client
│   ├── App.js
│   ├── package.json
│   ├── app.json
│   └── README.md
├── keycloak/               # Keycloak configuration
│   ├── realm-config/
│   │   └── yopago-realm.json
│   └── README.md
├── database/               # PostgreSQL setup
│   ├── init/
│   │   └── 01-init.sql
│   └── README.md
├── k8s/                    # Kubernetes manifests
│   ├── base/               # Base resources
│   │   ├── namespace-and-secrets.yaml
│   │   ├── postgres.yaml
│   │   ├── keycloak.yaml
│   │   ├── api.yaml
│   │   └── ingress.yaml
│   ├── overlays/
│   │   ├── dev/           # Development overlay
│   │   └── prod/          # Production overlay
│   └── README.md
├── docker-compose.yml      # Local orchestration
├── .env.example           # Environment variables template
├── Makefile               # Common tasks
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Docker** and **Docker Compose** (for local development)
- **Java 17+** and **Maven 3.8+** (for backend development)
- **Node.js 18+** and **npm** (for mobile development)
- **kubectl** (for Kubernetes deployment)

### Local Development with Docker Compose

1. **Clone the repository**
   ```bash
   git clone https://github.com/LuvaSoftEC/yopago.git
   cd yopago
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Review and adjust .env if needed
   ```

3. **Start all services**
   ```bash
   make up
   # Or: docker-compose up -d
   ```

4. **Access the services**
   - API: http://localhost:8080
   - Keycloak: http://localhost:8180 (admin/admin)
   - PostgreSQL: localhost:5432

5. **View logs**
   ```bash
   make logs
   # Or: docker-compose logs -f
   ```

### Running Backend Locally (without Docker)

1. **Start PostgreSQL and Keycloak**
   ```bash
   docker-compose up -d postgres keycloak
   ```

2. **Build and run the API**
   ```bash
   cd backend
   mvn clean package
   mvn spring-boot:run
   ```

### Running Mobile App

1. **Install dependencies**
   ```bash
   cd mobile
   npm install
   ```

2. **Start Expo**
   ```bash
   npm start
   ```

3. **Run on platform**
   ```bash
   npm run android  # For Android
   npm run ios      # For iOS
   npm run web      # For web
   ```

## 🔐 Authentication

YoPago uses Keycloak for authentication and authorization.

### Default Credentials

**Keycloak Admin Console** (http://localhost:8180):
- Username: `admin`
- Password: `admin`

**Demo User** (for testing the app):
- Username: `demo`
- Password: `demo123`
- Email: `demo@yopago.com`

### OAuth2 Flow

The mobile app uses OAuth2 Authorization Code flow with PKCE. The Spring Boot API validates JWT tokens issued by Keycloak.

## 🗄️ Database

### Schema

- **expense_groups**: Groups for organizing expenses
- **expenses**: Individual expense records

### Migrations

Database migrations are managed by Flyway. Migration files are located in `backend/src/main/resources/db/migration/`.

### Sample Data

The database is initialized with sample data for development:
- 2 expense groups
- 4 sample expenses

## 🧪 Testing

### Backend Tests

```bash
cd backend
mvn test
```

### API Health Check

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8080/api/public/health
```

## ☸️ Kubernetes Deployment

### Development Environment

```bash
make k8s-apply-dev
# Or: kubectl apply -k k8s/overlays/dev/
```

### Production Environment

1. **Update secrets**
   ```bash
   # Edit k8s/base/namespace-and-secrets.yaml
   # Replace default passwords with strong ones
   ```

2. **Update ingress domains**
   ```bash
   # Edit k8s/base/ingress.yaml
   # Replace example.com with your actual domains
   ```

3. **Deploy**
   ```bash
   make k8s-apply-prod
   # Or: kubectl apply -k k8s/overlays/prod/
   ```

4. **Check status**
   ```bash
   make k8s-status
   # Or: kubectl get all -n yopago
   ```

See [k8s/README.md](k8s/README.md) for detailed Kubernetes documentation.

## 🔧 Configuration

### Environment Variables

Create a `.env` file from `.env.example`:

```bash
# PostgreSQL
POSTGRES_DB=yopago
POSTGRES_USER=yopago
POSTGRES_PASSWORD=yopago123

# Keycloak
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# API
SPRING_PROFILES_ACTIVE=dev
```

### Backend Configuration

Backend configuration is in `backend/src/main/resources/application.properties`. Key settings:

- Database connection
- Keycloak OAuth2 settings
- Actuator endpoints
- Logging levels

### Mobile Configuration

Mobile app configuration is in `mobile/app.json`. Key settings:

- API URL
- Keycloak URL and realm
- Client ID

## 📊 API Endpoints

### Public Endpoints

- `GET /api/public/health` - Health check

### Protected Endpoints (require authentication)

- `GET /api/expenses` - List all expenses
- `GET /api/expenses/{id}` - Get expense by ID
- `GET /api/expenses/my` - Get current user's expenses
- `GET /api/expenses/group/{groupId}` - Get expenses by group
- `POST /api/expenses` - Create new expense
- `PUT /api/expenses/{id}` - Update expense
- `DELETE /api/expenses/{id}` - Delete expense

### Actuator Endpoints

- `GET /actuator/health` - Application health
- `GET /actuator/info` - Application info
- `GET /actuator/metrics` - Application metrics

## 🛠️ Development Tools

### Makefile Commands

```bash
make help              # Show all available commands
make up                # Start all services
make down              # Stop all services
make logs              # View logs
make backend-build     # Build backend
make backend-test      # Run backend tests
make mobile-install    # Install mobile dependencies
make mobile-start      # Start Expo
make db-shell          # Connect to database
make k8s-apply-dev     # Deploy to Kubernetes dev
```

See `make help` for a complete list of commands.

## 🔍 Monitoring and Logging

### Local Development

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f keycloak
docker-compose logs -f postgres
```

### Kubernetes

```bash
# View API logs
kubectl logs -f deployment/yopago-api -n yopago

# View all pods
kubectl get pods -n yopago

# View events
kubectl get events -n yopago --sort-by='.lastTimestamp'
```

## 🔒 Security

### Best Practices Implemented

- OAuth2/OIDC authentication via Keycloak
- JWT token validation
- HTTPS support (in production)
- SQL injection prevention (JPA/Hibernate)
- CSRF protection (stateless REST API)
- Secure password storage (Keycloak)
- Brute force protection (Keycloak)

### Production Security Checklist

- [ ] Change all default passwords
- [ ] Enable HTTPS/TLS
- [ ] Configure proper CORS policies
- [ ] Set up network policies in Kubernetes
- [ ] Enable pod security standards
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Regular security updates
- [ ] Container image scanning
- [ ] Set up audit logging

## 📚 Additional Documentation

- [Backend README](backend/README.md) - Spring Boot API details
- [Mobile README](mobile/README.md) - React Native app details
- [Keycloak README](keycloak/README.md) - Authentication setup
- [Database README](database/README.md) - Database schema and setup
- [Kubernetes README](k8s/README.md) - Deployment guide

## 🤝 Contributing

This is an educational project demonstrating DevOps practices. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🎯 Project Goals

YoPago serves as a practical demonstration of:

- Microservices architecture
- Container orchestration with Docker and Kubernetes
- Identity and access management with Keycloak
- RESTful API design with Spring Boot
- Mobile app development with React Native
- Infrastructure as Code
- DevOps best practices
- CI/CD readiness

## 🙏 Acknowledgments

Built with:
- [Spring Boot](https://spring.io/projects/spring-boot)
- [React Native](https://reactnative.dev/)
- [Expo](https://expo.dev/)
- [Keycloak](https://www.keycloak.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [Kubernetes](https://kubernetes.io/)
- [Docker](https://www.docker.com/)
