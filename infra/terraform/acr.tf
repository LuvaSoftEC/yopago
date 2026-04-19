# ── Azure Container Registry ──────────────────────────────────────────────────
# Almacena las imágenes Docker de todos los servicios de YoPago.
# El SKU Basic es suficiente para dev/curso (~$5/mes).

resource "azurerm_container_registry" "main" {
  name                = "${replace(var.project_name, "-", "")}${var.environment}acr"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false  # AKS usa Managed Identity, no credenciales de admin
  tags                = local.tags
}

# ── Permiso AKS → ACR (AcrPull) ──────────────────────────────────────────────
# Permite que AKS descargue imágenes de ACR sin credenciales explícitas.
# Usa la Managed Identity del kubelet (identidad del node pool).

resource "azurerm_role_assignment" "aks_acr_pull" {
  principal_id                     = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                            = azurerm_container_registry.main.id
  skip_service_principal_aad_check = true
}
