# DataPulse CI/CD & Infrastructure

## Overview

This directory contains all the infrastructure-as-code (IaC) and CI/CD configurations for DataPulse, designed to handle 500K+ concurrent users.

## Directory Structure

```
.github/
├── workflows/
│   ├── ci-cd.yml          # Main CI/CD pipeline
│   ├── pr-checks.yml      # Pull request checks
│   ├── security.yml       # Weekly security scans
│   └── rollback.yml       # Manual rollback workflow
├── dependabot.yml         # Automated dependency updates

infrastructure/
├── kubernetes/            # Raw K8s manifests
├── helm/                  # Helm chart
├── docker-compose/        # Local development
├── mongodb/               # MongoDB configurations
└── scripts/               # Deployment scripts
```

## CI/CD Pipeline

### Workflow: `ci-cd.yml`

**Trigger Events:**
- Push to `main` → Deploy to Production
- Push to `develop` → Deploy to Staging
- Pull Request → Run tests only
- Manual dispatch → Select environment

**Pipeline Stages:**
```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────┐    ┌────────────┐
│  Lint   │───▶│ Test Backend │───▶│ Test Frontend│───▶│  Build  │───▶│  Staging   │
└─────────┘    └──────────────┘    └──────────────┘    └─────────┘    └────────────┘
                                                                             │
                                                                             ▼
                                                                      ┌────────────┐
                                                                      │ Production │
                                                                      └────────────┘
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `KUBE_CONFIG_STAGING` | Base64 encoded kubeconfig for staging cluster |
| `KUBE_CONFIG_PRODUCTION` | Base64 encoded kubeconfig for production cluster |
| `MONGO_URL_STAGING` | MongoDB connection string for staging |
| `MONGO_URL_PRODUCTION` | MongoDB connection string for production |
| `REDIS_URL_STAGING` | Redis connection string for staging |
| `REDIS_URL_PRODUCTION` | Redis connection string for production |
| `JWT_SECRET_KEY` | JWT signing secret key |
| `STRIPE_API_KEY` | Stripe API key for payments |
| `EMERGENT_LLM_KEY` | Emergent LLM API key |

### Setting Up Secrets

```bash
# Encode kubeconfig
cat ~/.kube/config | base64 -w 0

# Add to GitHub Secrets via CLI
gh secret set KUBE_CONFIG_STAGING < staging-kubeconfig.txt
gh secret set KUBE_CONFIG_PRODUCTION < production-kubeconfig.txt
```

## Deployment

### Deploy to Staging

```bash
# Option 1: Push to develop branch
git push origin develop

# Option 2: Manual trigger via GitHub UI
# Go to Actions → CI/CD Pipeline → Run workflow → Select "staging"

# Option 3: Use deployment script
cd infrastructure/scripts
./deploy.sh staging apply
```

### Deploy to Production

```bash
# Option 1: Push to main branch
git push origin main

# Option 2: Manual trigger via GitHub UI
# Go to Actions → CI/CD Pipeline → Run workflow → Select "production"

# Option 3: Use deployment script
cd infrastructure/scripts
./deploy.sh production apply
```

### Rollback

```bash
# Option 1: Use GitHub Actions UI
# Go to Actions → Rollback → Run workflow

# Option 2: Use Helm directly
helm rollback datapulse -n datapulse

# Option 3: Use rollback script
cd infrastructure/scripts
./rollback.sh production 1
```

## Kubernetes Configuration

### Scaling Configuration

| Component | Min Replicas | Max Replicas | CPU Target |
|-----------|--------------|--------------|------------|
| Backend | 20 | 100 | 70% |
| Frontend | 5 | 20 | 70% |

### Resource Limits

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----------|-------------|-----------|----------------|--------------|
| Backend | 1 core | 4 cores | 2 GB | 8 GB |
| Frontend | 200m | 1 core | 256 MB | 512 MB |

## Helm Deployment

### Install/Upgrade

```bash
helm upgrade --install datapulse ./infrastructure/helm/datapulse \
  --namespace datapulse \
  --create-namespace \
  --values ./infrastructure/helm/datapulse/values.yaml \
  --set backend.secrets.mongoUrl="mongodb+srv://..." \
  --set backend.secrets.redisUrl="redis://..." \
  --set backend.secrets.jwtSecretKey="your-secret"
```

### Custom Values per Environment

Create `values-staging.yaml` or `values-production.yaml`:

```yaml
# values-staging.yaml
global:
  environment: staging

backend:
  replicaCount: 3
  autoscaling:
    minReplicas: 3
    maxReplicas: 10

frontend:
  replicaCount: 2
```

## Monitoring & Observability

### Prometheus Metrics

The backend exposes metrics at `/api/metrics`:
- Request latency
- Request count by endpoint
- Error rates
- Database connection pool stats

### Health Checks

| Endpoint | Purpose |
|----------|---------|
| `/api/health` | Full health check (DB, Redis, etc.) |
| `/api/` | Simple liveness check |

## Security

### Weekly Scans
- Dependency vulnerabilities (Safety, npm audit)
- Container image vulnerabilities (Trivy)
- Code security (CodeQL)

### Network Policies
- Backend only accessible from frontend and ingress
- Database only accessible from backend
- All egress restricted except necessary external services

## Troubleshooting

### View Logs
```bash
kubectl logs -f deployment/datapulse-backend -n datapulse
kubectl logs -f deployment/datapulse-frontend -n datapulse
```

### Check Pod Status
```bash
kubectl get pods -n datapulse -o wide
kubectl describe pod <pod-name> -n datapulse
```

### Helm Debug
```bash
helm list -n datapulse
helm history datapulse -n datapulse
helm get values datapulse -n datapulse
```

### Force Restart
```bash
kubectl rollout restart deployment/datapulse-backend -n datapulse
kubectl rollout restart deployment/datapulse-frontend -n datapulse
```
