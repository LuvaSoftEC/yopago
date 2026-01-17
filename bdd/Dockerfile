# Dockerfile para un único servidor PostgreSQL para todo el sistema
FROM postgres:15

# Copia opcional de scripts de inicialización
COPY init-databases.sql /docker-entrypoint-initdb.d/

# Exponer el puerto estándar
EXPOSE 5432
