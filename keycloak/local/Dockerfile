FROM quay.io/keycloak/keycloak:22.0.1

# Copia del realm
COPY realm-config/yopago-realm.json /opt/keycloak/data/import/yopago-realm.json

# Exponemos el puerto por defecto
EXPOSE 8080

# Arranque en modo desarrollo (sin SSL, sin fase de build requerida)
ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start-dev", "--import-realm"]
