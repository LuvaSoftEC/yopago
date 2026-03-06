terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }

  # Remote state en Azure Blob Storage (recomendado para producción)
  # Descomenta y configura antes de ejecutar terraform init
  # backend "azurerm" {
  #   resource_group_name  = "yopago-tfstate-rg"
  #   storage_account_name = "yopagotfstate"
  #   container_name       = "tfstate"
  #   key                  = "yopago.terraform.tfstate"
  # }
}

provider "azurerm" {
  features {}
}

# ── Resource Group ────────────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.tags
}

# ── Tags comunes ──────────────────────────────────────────────────────────────

locals {
  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }
}
