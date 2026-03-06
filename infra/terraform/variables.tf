# ── Generales ─────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Nombre del proyecto. Se usa como prefijo en todos los recursos."
  type        = string
  default     = "yopago"
}

variable "environment" {
  description = "Entorno de despliegue: dev, test, prod"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "El entorno debe ser dev, test o prod."
  }
}

variable "location" {
  description = "Región de Azure donde se crearán los recursos."
  type        = string
  default     = "eastus2"
}

variable "resource_group_name" {
  description = "Nombre del Resource Group principal."
  type        = string
  default     = "yopago-dev-rg"
}

# ── AKS ──────────────────────────────────────────────────────────────────────

variable "kubernetes_version" {
  description = "Versión de Kubernetes. Usa 'az aks get-versions --location eastus2' para ver las disponibles."
  type        = string
  default     = "1.29"
}

variable "aks_node_count" {
  description = "Número de nodos en el node pool principal."
  type        = number
  default     = 1
}

variable "aks_node_vm_size" {
  description = "Tamaño de VM para los nodos de AKS. Standard_B2s = 2vCPU / 4GB RAM (mínimo recomendado)."
  type        = string
  default     = "Standard_B2s"
}

variable "aks_os_disk_size_gb" {
  description = "Tamaño del disco OS de cada nodo en GB."
  type        = number
  default     = 30
}

# ── PostgreSQL ───────────────────────────────────────────────────────────────

variable "postgres_admin_user" {
  description = "Usuario administrador de PostgreSQL. No uses 'admin', 'postgres' o 'root'."
  type        = string
  default     = "yopagoadmin"
}

variable "postgres_admin_password" {
  description = "Contraseña del administrador de PostgreSQL. Mínimo 8 caracteres, mayúsculas, minúsculas, números y símbolos."
  type        = string
  sensitive   = true
}

variable "postgres_sku" {
  description = "SKU del servidor PostgreSQL. B_Standard_B1ms es el más barato para dev/curso."
  type        = string
  default     = "B_Standard_B1ms"
  # Opciones comunes:
  # B_Standard_B1ms   → 1 vCore,  2 GB RAM  (~$12/mes)  — dev/curso
  # B_Standard_B2s    → 2 vCores, 4 GB RAM  (~$25/mes)  — test
  # GP_Standard_D2s_v3→ 2 vCores, 8 GB RAM  (~$135/mes) — prod
}

variable "postgres_storage_mb" {
  description = "Almacenamiento del servidor PostgreSQL en MB. Mínimo 32768 (32 GB)."
  type        = number
  default     = 32768
}

variable "postgres_version" {
  description = "Versión de PostgreSQL."
  type        = string
  default     = "15"
}
