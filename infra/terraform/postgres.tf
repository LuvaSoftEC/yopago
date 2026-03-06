# ── Azure Database for PostgreSQL Flexible Server ─────────────────────────────
# Reemplaza el postgres.yaml de K8s: la DB corre como servicio gestionado de Azure,
# no como pod. Esto es la práctica recomendada en producción.
#
# Costo estimado:
#   B_Standard_B1ms  (~$12/mes)  — dev / curso
#   B_Standard_B2s   (~$25/mes)  — test
#   GP_Standard_D2s_v3 (~$135/mes) — prod

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "${var.project_name}-${var.environment}-db"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = var.postgres_version
  administrator_login    = var.postgres_admin_user
  administrator_password = var.postgres_admin_password
  storage_mb             = var.postgres_storage_mb
  sku_name               = var.postgres_sku
  zone                   = "1"

  # Backup automático: 7 días (mínimo, reduce costos)
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false

  tags = local.tags
}

# ── Base de datos: yopago ─────────────────────────────────────────────────────

resource "azurerm_postgresql_flexible_server_database" "yopago" {
  name      = "yopago"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# ── Base de datos: keycloak ───────────────────────────────────────────────────

resource "azurerm_postgresql_flexible_server_database" "keycloak" {
  name      = "keycloak"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# ── Firewall: acceso desde servicios Azure (AKS) ──────────────────────────────
# Permite conexiones desde cualquier IP dentro de Azure (incluido AKS).
# start_ip = end_ip = 0.0.0.0 es la convención de Azure para "Azure services".

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}
