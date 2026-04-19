# ── Azure Kubernetes Service ──────────────────────────────────────────────────
# Cluster AKS con:
#   - 1 nodo Standard_B2s (mínimo viable para el stack de YoPago)
#   - Managed Identity (sin Service Principal que rotar)
#   - RBAC habilitado
#   - Monitoring básico deshabilitado por defecto (reduce costos en el curso)

resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.project_name}-${var.environment}-aks"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${var.project_name}-${var.environment}"
  kubernetes_version  = var.kubernetes_version

  # ── Node Pool principal ────────────────────────────────────────────────────
  default_node_pool {
    name                = "system"
    node_count          = var.aks_node_count
    vm_size             = var.aks_node_vm_size
    os_disk_size_gb     = var.aks_os_disk_size_gb
    type                = "VirtualMachineScaleSets"

    # Etiquetas en los nodos
    node_labels = {
      "role" = "system"
    }
  }

  # ── Identidad ──────────────────────────────────────────────────────────────
  # SystemAssigned: Azure gestiona la identidad automáticamente.
  # Necesaria para que AKS interactúe con ACR y otros servicios de Azure.
  identity {
    type = "SystemAssigned"
  }

  # ── Red ────────────────────────────────────────────────────────────────────
  network_profile {
    network_plugin    = "kubenet"
    load_balancer_sku = "standard"
  }

  # ── RBAC ───────────────────────────────────────────────────────────────────
  role_based_access_control_enabled = true

  tags = local.tags
}
