# Keycloak — YoPago

Imagen personalizada de Keycloak 22 con el realm `yopago` preconfigurado.

## Estructura

```
keycloak/
├── Dockerfile               ← imagen para Azure (producción)
├── realm-config/
│   └── yopago-realm.json    ← realm de producción
└── local/
    ├── Dockerfile            ← imagen para docker-compose / KIND
    └── realm-config/
        └── yopago-realm.json ← realm local (sin SSL, secrets hardcoded)
```

## Diferencias local vs producción

| | Local | Producción (Azure) |
|---|---|---|
| Modo arranque | `start-dev` | `start` |
| `sslRequired` | `none` | `external` (SSL en ingress) |
| Build requerido | No | Sí (fase interna de Keycloak) |

## Realm configurado

- **Realm:** `yopago`
- **Roles:** `admin`, `user`, `group_manager`
- **Usuario por defecto:** `admin` / `changeme`
- **Clientes:**
  - `yopago-api` — confidencial, usado por el backend (Spring Boot)
  - `yopago-mobile` — público con PKCE, usado por el frontend (Expo)

## Secretos — punto crítico

El client secret de `yopago-api` está hardcodeado como `changeme` en el realm JSON.
**Debe coincidir en los tres lugares:**

```
keycloak/realm-config/yopago-realm.json  →  "secret": "changeme"
                    ↕
infra/k8s/azure/secrets (K8s)            →  KEYCLOAK_CLIENT_SECRET=changeme
                    ↕
backend env                              →  KEYCLOAK_CREDENTIALS_SECRET=changeme
```

Si cambias el secret en producción debes:
1. Actualizar `realm-config/yopago-realm.json`
2. Hacer rebuild de la imagen de Keycloak y push al ACR
3. Actualizar el secret de K8s (`kubectl apply` o pipeline)

## Uso local (docker-compose)

```bash
# Desde la raíz del proyecto
docker compose up keycloak

# Keycloak Admin UI
# http://localhost:8082
# Usuario: admin  |  Password: el de KEYCLOAK_ADMIN_PASSWORD en tu .env
```

El realm se importa automáticamente al arrancar (`--import-realm`).
Solo se importa si el realm NO existe aún en la base de datos.

## Uso en Azure (AKS)

El pipeline de GitHub Actions construye y sube la imagen automáticamente:

```
keycloak/Dockerfile  →  ACR: yopago-keycloak:latest  →  AKS deployment
```

Para forzar reimportación del realm en AKS hay que eliminar la base de datos
`keycloak` en PostgreSQL o usar la Admin API de Keycloak directamente.
