# Kubernetes Deployment for YoPago

This directory contains Kubernetes manifests for deploying YoPago in a production environment.

## Structure

```
k8s/
├── base/                          # Base Kubernetes resources
│   ├── namespace-and-secrets.yaml # Namespace and secrets
│   ├── postgres.yaml              # PostgreSQL database
│   ├── keycloak.yaml              # Keycloak identity provider
│   ├── api.yaml                   # YoPago API backend
│   └── ingress.yaml               # Ingress configuration
├── overlays/
│   ├── dev/                       # Development environment
│   └── prod/                      # Production environment
└── README.md
```

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Storage class for persistent volumes
- Ingress controller (nginx recommended)
- cert-manager (for TLS certificates)

## Quick Start

### 1. Create Secrets

**⚠️ CRITICAL: Replace default passwords before deploying!**

First, update the secrets in `base/namespace-and-secrets.yaml` with strong passwords:

```bash
# Generate strong passwords
openssl rand -base64 32

# Edit the file and replace REPLACE_WITH_STRONG_PASSWORD with the generated values
vi base/namespace-and-secrets.yaml
```

### 2. Deploy All Services

```bash
# Deploy to development
kubectl apply -k overlays/dev/

# Deploy to production
kubectl apply -k overlays/prod/
```

Or deploy individual components:

```bash
# Deploy namespace and secrets
kubectl apply -f base/namespace-and-secrets.yaml

# Deploy database
kubectl apply -f base/postgres.yaml

# Deploy Keycloak
kubectl apply -f base/keycloak.yaml

# Deploy API
kubectl apply -f base/api.yaml

# Deploy Ingress
kubectl apply -f base/ingress.yaml
```

### 3. Verify Deployment

```bash
# Check all resources in yopago namespace
kubectl get all -n yopago

# Check pod status
kubectl get pods -n yopago

# View logs
kubectl logs -f deployment/yopago-api -n yopago
kubectl logs -f deployment/keycloak -n yopago
kubectl logs -f deployment/postgres -n yopago
```

## Configuration

### Secrets

Update these values in `base/namespace-and-secrets.yaml`:
- `POSTGRES_PASSWORD`
- `KEYCLOAK_ADMIN_PASSWORD`

### ConfigMap

Adjust environment-specific settings in `base/namespace-and-secrets.yaml`:
- `POSTGRES_DB`
- `KEYCLOAK_REALM`
- `SPRING_PROFILES_ACTIVE`

### Ingress

Update domain names in `base/ingress.yaml`:
- Replace `api.yopago.example.com` with your API domain
- Replace `auth.yopago.example.com` with your Keycloak domain

### Storage

Adjust storage sizes in respective deployment files:
- PostgreSQL: `postgres.yaml` (default: 10Gi)
- Keycloak: `keycloak.yaml` (default: 5Gi)

## Scaling

### Scale API Replicas

```bash
kubectl scale deployment yopago-api --replicas=3 -n yopago
```

### Horizontal Pod Autoscaler

```bash
kubectl autoscale deployment yopago-api \
  --cpu-percent=80 \
  --min=2 \
  --max=10 \
  -n yopago
```

## Monitoring

### Check Resource Usage

```bash
kubectl top pods -n yopago
kubectl top nodes
```

### View Events

```bash
kubectl get events -n yopago --sort-by='.lastTimestamp'
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see events
kubectl describe pod <pod-name> -n yopago

# Check logs
kubectl logs <pod-name> -n yopago

# Get previous logs if pod restarted
kubectl logs <pod-name> -n yopago --previous
```

### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -it deployment/yopago-api -n yopago -- sh
# Inside container:
# nc -zv postgres 5432
```

### Ingress Not Working

```bash
# Check ingress status
kubectl describe ingress yopago-ingress -n yopago

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

## Backup and Restore

### Database Backup

```bash
# Create backup
kubectl exec -it deployment/postgres -n yopago -- \
  pg_dump -U yopago yopago > backup.sql

# Restore backup
kubectl exec -i deployment/postgres -n yopago -- \
  psql -U yopago yopago < backup.sql
```

## Cleanup

```bash
# Delete all resources
kubectl delete namespace yopago

# Or delete individual components
kubectl delete -f base/ingress.yaml
kubectl delete -f base/api.yaml
kubectl delete -f base/keycloak.yaml
kubectl delete -f base/postgres.yaml
kubectl delete -f base/namespace-and-secrets.yaml
```

## Production Considerations

1. **Use External Database**: Consider using managed PostgreSQL (AWS RDS, GCP Cloud SQL)
2. **High Availability**: Run multiple replicas with PodDisruptionBudget
3. **Persistent Storage**: Use reliable storage class with backups
4. **TLS Certificates**: Configure cert-manager for automatic certificate management
5. **Resource Limits**: Set appropriate CPU/memory limits
6. **Network Policies**: Implement network policies for security
7. **Monitoring**: Set up Prometheus and Grafana for monitoring
8. **Logging**: Use ELK or similar stack for centralized logging
9. **Secrets Management**: Use external secrets manager (Vault, AWS Secrets Manager)
10. **CI/CD**: Implement automated deployment pipeline

## Security Hardening

- Enable Pod Security Standards
- Use NetworkPolicies to restrict pod communication
- Regularly update container images
- Scan images for vulnerabilities
- Use non-root users in containers
- Enable RBAC with least privilege principle
- Encrypt data at rest and in transit
