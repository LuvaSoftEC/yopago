# ── ACR ───────────────────────────────────────────────────────────────────────

output "acr_login_server" {
  description = "URL del Azure Container Registry. Úsalo como prefijo de tus imágenes Docker."
  value       = azurerm_container_registry.main.login_server
}

output "acr_name" {
  description = "Nombre del Azure Container Registry."
  value       = azurerm_container_registry.main.name
}

# ── AKS ───────────────────────────────────────────────────────────────────────

output "aks_cluster_name" {
  description = "Nombre del cluster AKS."
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_resource_group" {
  description = "Resource Group donde está el cluster AKS."
  value       = azurerm_resource_group.main.name
}

output "aks_get_credentials_cmd" {
  description = "Comando para configurar kubectl apuntando al cluster AKS."
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

# ── PostgreSQL ────────────────────────────────────────────────────────────────

output "postgres_host" {
  description = "FQDN del servidor PostgreSQL. Úsalo en DB_URL de los manifiestos K8s."
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_admin_user" {
  description = "Usuario administrador de PostgreSQL."
  value       = azurerm_postgresql_flexible_server.main.administrator_login
}

output "postgres_connection_string_yopago" {
  description = "JDBC connection string lista para copiar en backend.yaml."
  value       = "jdbc:postgresql://${azurerm_postgresql_flexible_server.main.fqdn}:5432/yopago?sslmode=require"
}

output "postgres_connection_string_keycloak" {
  description = "JDBC connection string lista para copiar en keycloak.yaml."
  value       = "jdbc:postgresql://${azurerm_postgresql_flexible_server.main.fqdn}:5432/keycloak?sslmode=require"
}

# ── Resumen ───────────────────────────────────────────────────────────────────

output "next_steps" {
  description = "Pasos a seguir después de aplicar Terraform."
  value       = <<-EOT
    ✅ Infraestructura creada. Próximos pasos:

    1. Configura kubectl:
       az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}

    2. Instala NGINX Ingress Controller en AKS:
       helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
       helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace

    3. Actualiza infra/k8s/azure/backend.yaml con:
       DB_URL: jdbc:postgresql://${azurerm_postgresql_flexible_server.main.fqdn}:5432/yopago?sslmode=require

    4. Actualiza infra/k8s/azure/keycloak.yaml con:
       KC_DB_URL: jdbc:postgresql://${azurerm_postgresql_flexible_server.main.fqdn}:5432/keycloak?sslmode=require

    5. Actualiza infra/k8s/azure/*.yaml con:
       image: ${azurerm_container_registry.main.login_server}/yopago-backend:latest
  EOT
}
