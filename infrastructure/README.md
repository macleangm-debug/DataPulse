# DataPulse Infrastructure - Production Deployment Guide
# Target: 500K concurrent users

## Architecture Overview

```
                                    ┌─────────────────────────────────────────────────────────┐
                                    │                    CLOUDFLARE CDN                        │
                                    │              (Static assets, DDoS protection)            │
                                    └─────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
                                    ┌─────────────────────────────────────────────────────────┐
                                    │                 KUBERNETES INGRESS                       │
                                    │           (nginx-ingress / AWS ALB / GCP LB)            │
                                    │                 Rate Limiting: 10K req/s                 │
                                    └─────────────────────────────────────────────────────────┘
                                                              │
                          ┌───────────────────────────────────┼───────────────────────────────────┐
                          │                                   │                                   │
                          ▼                                   ▼                                   ▼
              ┌─────────────────────┐           ┌─────────────────────┐           ┌─────────────────────┐
              │   Frontend Pods     │           │   Frontend Pods     │           │   Frontend Pods     │
              │   (React SSR/CDN)   │           │   (React SSR/CDN)   │           │   (React SSR/CDN)   │
              │   Replicas: 5-20    │           │   Replicas: 5-20    │           │   Replicas: 5-20    │
              └─────────────────────┘           └─────────────────────┘           └─────────────────────┘
                          │                                   │                                   │
                          └───────────────────────────────────┼───────────────────────────────────┘
                                                              │
                                                              ▼
                                    ┌─────────────────────────────────────────────────────────┐
                                    │              INTERNAL SERVICE MESH                       │
                                    │                   (Istio / Linkerd)                      │
                                    └─────────────────────────────────────────────────────────┘
                                                              │
                          ┌───────────────────────────────────┼───────────────────────────────────┐
                          │                                   │                                   │
                          ▼                                   ▼                                   ▼
              ┌─────────────────────┐           ┌─────────────────────┐           ┌─────────────────────┐
              │   Backend Pods      │           │   Backend Pods      │           │   Backend Pods      │
              │   (FastAPI)         │           │   (FastAPI)         │           │   (FastAPI)         │
              │   Replicas: 20-100  │           │   Replicas: 20-100  │           │   Replicas: 20-100  │
              │   CPU: 2 | RAM: 4GB │           │   CPU: 2 | RAM: 4GB │           │   CPU: 2 | RAM: 4GB │
              └─────────────────────┘           └─────────────────────┘           └─────────────────────┘
                          │                                   │                                   │
                          └───────────────────────────────────┼───────────────────────────────────┘
                                                              │
                    ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
                    │                                         │                                         │
                    ▼                                         ▼                                         ▼
      ┌───────────────────────────┐             ┌───────────────────────────┐             ┌───────────────────────────┐
      │     REDIS CLUSTER         │             │    MONGODB SHARDED        │             │     MESSAGE QUEUE         │
      │     (6 nodes: 3M + 3S)    │             │    CLUSTER                │             │     (RabbitMQ/Kafka)      │
      │     Sessions, Cache       │             │    3 Shards × 3 Replicas  │             │     Async Processing      │
      │     Memory: 32GB total    │             │    9 nodes total          │             │                           │
      └───────────────────────────┘             └───────────────────────────┘             └───────────────────────────┘
```

## Resource Requirements for 500K Users

### Compute Resources
| Component | Instances | CPU (cores) | Memory | Storage |
|-----------|-----------|-------------|--------|---------|
| Frontend | 10-20 | 1-2 | 2GB | - |
| Backend | 50-100 | 2-4 | 4GB | - |
| Redis | 6 (cluster) | 2 | 8GB | 50GB SSD |
| MongoDB | 9 (sharded) | 4-8 | 32GB | 500GB SSD |
| Message Queue | 3 | 2 | 4GB | 100GB SSD |

### Estimated Monthly Costs (AWS)
- **EKS Cluster**: ~$150/month
- **EC2 Instances (Backend)**: ~$3,000-6,000/month
- **MongoDB Atlas M50**: ~$1,500/month (or self-hosted)
- **ElastiCache Redis**: ~$500/month
- **Load Balancer + Data Transfer**: ~$500/month
- **Total**: ~$6,000-9,000/month

## Directory Structure
```
/infrastructure/
├── kubernetes/           # K8s manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── backend-hpa.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── frontend-hpa.yaml
│   ├── ingress.yaml
│   ├── redis-cluster.yaml
│   └── network-policy.yaml
├── docker-compose/       # Local multi-instance testing
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx.conf
├── mongodb/              # MongoDB sharding configs
│   ├── mongod-shard.conf
│   ├── mongod-config.conf
│   ├── mongos.conf
│   └── init-sharding.js
├── helm/                 # Helm chart
│   └── datapulse/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
└── scripts/              # Deployment scripts
    ├── deploy.sh
    ├── scale.sh
    └── rollback.sh
```

## Quick Start

### Option 1: Kubernetes (Production)
```bash
# 1. Create namespace and secrets
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/secrets.yaml
kubectl apply -f kubernetes/configmap.yaml

# 2. Deploy backend and frontend
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/backend-service.yaml
kubectl apply -f kubernetes/backend-hpa.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl apply -f kubernetes/frontend-service.yaml
kubectl apply -f kubernetes/frontend-hpa.yaml

# 3. Setup ingress
kubectl apply -f kubernetes/ingress.yaml

# 4. Verify deployment
kubectl get pods -n datapulse
kubectl get hpa -n datapulse
```

### Option 2: Helm Chart
```bash
# Install with Helm
helm install datapulse ./helm/datapulse \
  --namespace datapulse \
  --create-namespace \
  --values helm/datapulse/values.yaml

# Upgrade
helm upgrade datapulse ./helm/datapulse \
  --namespace datapulse \
  --values helm/datapulse/values-production.yaml
```

### Option 3: Docker Compose (Testing)
```bash
# Start multi-instance setup
docker-compose -f docker-compose/docker-compose.prod.yml up -d --scale backend=5

# Check status
docker-compose ps
```

## Scaling Commands

```bash
# Manual scale backend
kubectl scale deployment datapulse-backend --replicas=50 -n datapulse

# Check HPA status
kubectl get hpa -n datapulse -w

# View pod distribution
kubectl get pods -n datapulse -o wide
```
