FROM quay.io/keycloak/keycloak:22.0.1

# Copia del realm
COPY realm-config/yopago-realm.json /opt/keycloak/data/import/yopago-realm-local.json


# Volúmenes persistentes
VOLUME /opt/keycloak/data
VOLUME /opt/keycloak/data/import

# Exponemos el puerto por defecto
EXPOSE 8080

# Arranque en modo producción
ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start", "--import-realm"]
