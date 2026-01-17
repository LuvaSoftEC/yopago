# --------- Build stage ---------
FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
WORKDIR /workspace

# Copiar lo mínimo para cachear dependencias
COPY pom.xml ./
COPY .mvn/ .mvn/
COPY mvnw ./
RUN mvn -q -e -DskipTests dependency:go-offline

# Código
COPY src ./src
RUN mvn -q -DskipTests package && \
    # Toma el jar "ejecutable" (excluye *original*)
    cp $(ls target/*.jar | grep -v 'original' | head -n1) app.jar

# --------- Runtime stage ---------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Networking tools for runtime diagnostics (Alpine usa apk)
RUN apk add --no-cache curl iputils bind-tools

# Usuario no root
RUN addgroup -S appuser && adduser -S appuser -G appuser && \
    mkdir -p /app && chown -R appuser:appuser /app

# Copiar jar
COPY --from=build /workspace/app.jar /app/app.jar

# Variables útiles
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError" \
    SPRING_PROFILES_ACTIVE=testing

# MUY IMPORTANTE: expone el puerto esperado por Azure
EXPOSE 8080

USER appuser

# Healthcheck opcional (si usas actuator)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
#   CMD wget -qO- http://127.0.0.1:8080/actuator/health | grep -q '"status":"UP"' || exit 1

# Fuerza el puerto: usa PORT si la plataforma lo define; si no, 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar /app/app.jar"]
