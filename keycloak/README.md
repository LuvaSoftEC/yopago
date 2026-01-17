# Keycloak Setup para YoPago - Con SQL Server

Este directorio contiene la configuración independiente de Keycloak para el proyecto YoPago, usando SQL Server como base de datos.

## 🏗️ Prerequisitos

1. **SQL Server corriendo** (desde el docker-compose principal)
2. **Base de datos keycloak creada**

### Preparar la base de datos:

```bash
# Opción 1: Usar el script SQL incluido
sqlcmd -S localhost,1433 -U sa -P YourStrong!Passw0rd -i init-keycloak-db.sql

# Opción 2: Crear manualmente
sqlcmd -S localhost,1433 -U sa -P YourStrong!Passw0rd -Q "CREATE DATABASE keycloak;"
```

## 🚀 Iniciar Keycloak

```bash
# Desde la carpeta keycloak-setup
docker compose up -d

# Ver logs
docker compose logs -f keycloak

# Detener
docker compose down
```

## 🗃️ Configuración de Base de Datos

- **Tipo**: Microsoft SQL Server  
- **Host**: host.docker.internal:1433
- **Database**: keycloak
- **Usuario**: sa
- **Password**: YourStrong!Passw0rd

## 🔧 Configuración

- **Puerto**: 8082
- **Admin Console**: http://localhost:8082/admin/
- **Realm**: yopago
- **Credenciales Admin**: admin / admin123

## 👥 Usuarios Preconfigurados

### Admin
- **Username**: admin
- **Password**: admin123
- **Roles**: admin, user

### Test User
- **Username**: testuser
- **Password**: password123
- **Roles**: user

## 🔑 Cliente API

- **Client ID**: yopago-api
- **Client Secret**: yopago-secret
- **Direct Access Grants**: Habilitado

## 🌐 URLs de Keycloak

- **Auth URL**: http://localhost:8082/realms/yopago/protocol/openid-connect/auth
- **Token URL**: http://localhost:8082/realms/yopago/protocol/openid-connect/token
- **UserInfo URL**: http://localhost:8082/realms/yopago/protocol/openid-connect/userinfo

## 🔄 Para integrar con la aplicación Spring Boot

Actualizar application.properties:

```properties
spring.security.oauth2.resourceserver.jwt.issuer-uri=http://localhost:8082/realms/yopago
spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://localhost:8082/realms/yopago/protocol/openid-connect/certs

keycloak.realm=yopago
keycloak.auth-server-url=http://localhost:8082
keycloak.resource=yopago-api
keycloak.credentials.secret=yopago-secret
```

## 🗂️ Estructura

```
keycloak-setup/
├── docker-compose.yml          # Configuración Docker de Keycloak con SQL Server
├── init-keycloak-db.sql       # Script para crear la base de datos
├── realm-config/
│   └── yopago-realm.json      # Configuración del realm yopago
└── README.md                  # Este archivo
```

## ✅ Ventajas de usar SQL Server

- **Persistencia robusta**: Datos almacenados en SQL Server en lugar de H2
- **Backup unificado**: Misma estrategia de backup para app y auth
- **Mejor rendimiento**: SQL Server optimizado para producción
- **Escalabilidad**: Manejo superior de conexiones concurrentes
- **Observabilidad**: Monitoreo unificado de todas las tablas