.PHONY: help build test clean up down logs restart

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Docker Compose targets
up: ## Start all services with docker-compose
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## View logs from all services
	docker-compose logs -f

restart: ## Restart all services
	docker-compose restart

clean: ## Stop and remove all containers, networks, and volumes
	docker-compose down -v

# Backend targets
backend-build: ## Build the Spring Boot API
	cd backend && mvn clean package

backend-test: ## Run backend tests
	cd backend && mvn test

backend-run: ## Run backend locally
	cd backend && mvn spring-boot:run

backend-docker: backend-build ## Build backend Docker image
	docker build -t yopago-api:latest backend/

# Mobile targets
mobile-install: ## Install mobile dependencies
	cd mobile && npm install

mobile-start: ## Start Expo development server
	cd mobile && npm start

mobile-android: ## Run on Android
	cd mobile && npm run android

mobile-ios: ## Run on iOS
	cd mobile && npm run ios

mobile-web: ## Run on web
	cd mobile && npm run web

# Database targets
db-up: ## Start only the database
	docker-compose up -d postgres

db-logs: ## View database logs
	docker-compose logs -f postgres

db-shell: ## Connect to database shell
	docker-compose exec postgres psql -U yopago yopago

db-backup: ## Backup database
	docker-compose exec postgres pg_dump -U yopago yopago > backup-$$(date +%Y%m%d-%H%M%S).sql

# Keycloak targets
keycloak-up: ## Start only Keycloak
	docker-compose up -d keycloak

keycloak-logs: ## View Keycloak logs
	docker-compose logs -f keycloak

# Kubernetes targets
k8s-apply-dev: ## Deploy to Kubernetes dev environment
	kubectl apply -k k8s/overlays/dev/

k8s-apply-prod: ## Deploy to Kubernetes prod environment
	kubectl apply -k k8s/overlays/prod/

k8s-delete: ## Delete all Kubernetes resources
	kubectl delete namespace yopago

k8s-status: ## Check Kubernetes deployment status
	kubectl get all -n yopago

k8s-logs-api: ## View API logs in Kubernetes
	kubectl logs -f deployment/yopago-api -n yopago

k8s-logs-keycloak: ## View Keycloak logs in Kubernetes
	kubectl logs -f deployment/keycloak -n yopago

# Development
dev-setup: ## Initial development setup
	cp .env.example .env
	@echo "Environment file created. Please review and update .env"
	@echo "Run 'make up' to start all services"

dev-clean: clean ## Clean development environment
	rm -rf backend/target
	rm -rf mobile/node_modules
	rm -rf mobile/.expo

# Testing
test-all: backend-test ## Run all tests
	@echo "All tests completed"

# Full stack operations
init: dev-setup mobile-install ## Initialize project (first time setup)
	@echo "Project initialized. Run 'make up' to start services"

status: ## Show status of all services
	docker-compose ps
