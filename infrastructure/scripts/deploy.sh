#!/bin/bash
# DataPulse Deployment Script
# Usage: ./deploy.sh [environment] [action]
# Examples:
#   ./deploy.sh staging apply
#   ./deploy.sh production apply
#   ./deploy.sh production dry-run

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
NAMESPACE="datapulse"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
ENVIRONMENT="${1:-staging}"
ACTION="${2:-apply}"

log_info "DataPulse Deployment"
log_info "Environment: $ENVIRONMENT"
log_info "Action: $ACTION"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    log_error "Valid environments: staging, production"
    exit 1
fi

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! command -v helm &> /dev/null; then
        log_error "helm not found. Please install helm."
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Deploy with kubectl
deploy_kubectl() {
    log_info "Deploying with kubectl..."
    
    local k8s_dir="$INFRA_DIR/kubernetes"
    local kubectl_cmd="kubectl"
    
    if [[ "$ACTION" == "dry-run" ]]; then
        kubectl_cmd="kubectl --dry-run=client"
    fi
    
    # Create namespace
    $kubectl_cmd apply -f "$k8s_dir/namespace.yaml"
    
    # Apply secrets (ensure they're created externally or from sealed-secrets)
    if [[ -f "$k8s_dir/secrets.yaml" ]] && [[ "$ENVIRONMENT" == "staging" ]]; then
        log_warn "Applying secrets from file (only for staging)"
        $kubectl_cmd apply -f "$k8s_dir/secrets.yaml"
    fi
    
    # Apply ConfigMaps
    $kubectl_cmd apply -f "$k8s_dir/configmap.yaml"
    
    # Deploy backend
    $kubectl_cmd apply -f "$k8s_dir/backend-deployment.yaml"
    $kubectl_cmd apply -f "$k8s_dir/backend-service.yaml"
    $kubectl_cmd apply -f "$k8s_dir/backend-hpa.yaml"
    
    # Deploy frontend
    $kubectl_cmd apply -f "$k8s_dir/frontend-deployment.yaml"
    $kubectl_cmd apply -f "$k8s_dir/frontend-service.yaml"
    $kubectl_cmd apply -f "$k8s_dir/frontend-hpa.yaml"
    
    # Apply network policies
    $kubectl_cmd apply -f "$k8s_dir/network-policy.yaml"
    
    # Apply ingress
    $kubectl_cmd apply -f "$k8s_dir/ingress.yaml"
    
    # Deploy Redis cluster
    $kubectl_cmd apply -f "$k8s_dir/redis-cluster.yaml"
    
    log_info "kubectl deployment complete."
}

# Deploy with Helm
deploy_helm() {
    log_info "Deploying with Helm..."
    
    local helm_dir="$INFRA_DIR/helm/datapulse"
    local values_file="$helm_dir/values.yaml"
    
    # Use environment-specific values if exists
    if [[ -f "$helm_dir/values-$ENVIRONMENT.yaml" ]]; then
        values_file="$helm_dir/values-$ENVIRONMENT.yaml"
    fi
    
    local helm_cmd="helm upgrade --install datapulse $helm_dir"
    helm_cmd+=" --namespace $NAMESPACE --create-namespace"
    helm_cmd+=" --values $values_file"
    
    if [[ "$ACTION" == "dry-run" ]]; then
        helm_cmd+=" --dry-run"
    fi
    
    # Add secrets via --set (get from environment or secrets manager)
    if [[ -n "${MONGO_URL:-}" ]]; then
        helm_cmd+=" --set backend.secrets.mongoUrl=$MONGO_URL"
    fi
    if [[ -n "${REDIS_URL:-}" ]]; then
        helm_cmd+=" --set backend.secrets.redisUrl=$REDIS_URL"
    fi
    if [[ -n "${JWT_SECRET_KEY:-}" ]]; then
        helm_cmd+=" --set backend.secrets.jwtSecretKey=$JWT_SECRET_KEY"
    fi
    if [[ -n "${EMERGENT_LLM_KEY:-}" ]]; then
        helm_cmd+=" --set backend.secrets.emergentLlmKey=$EMERGENT_LLM_KEY"
    fi
    
    eval $helm_cmd
    
    log_info "Helm deployment complete."
}

# Wait for deployment
wait_for_deployment() {
    log_info "Waiting for deployments to be ready..."
    
    kubectl rollout status deployment/datapulse-backend -n $NAMESPACE --timeout=300s
    kubectl rollout status deployment/datapulse-frontend -n $NAMESPACE --timeout=300s
    
    log_info "All deployments are ready."
}

# Show status
show_status() {
    log_info "Deployment Status:"
    echo ""
    
    echo "=== Pods ==="
    kubectl get pods -n $NAMESPACE -o wide
    echo ""
    
    echo "=== Services ==="
    kubectl get svc -n $NAMESPACE
    echo ""
    
    echo "=== HPAs ==="
    kubectl get hpa -n $NAMESPACE
    echo ""
    
    echo "=== Ingress ==="
    kubectl get ingress -n $NAMESPACE
    echo ""
}

# Main
main() {
    check_prerequisites
    
    case "$ACTION" in
        apply|dry-run)
            # Use Helm by default, fall back to kubectl
            if [[ -f "$INFRA_DIR/helm/datapulse/Chart.yaml" ]]; then
                deploy_helm
            else
                deploy_kubectl
            fi
            
            if [[ "$ACTION" == "apply" ]]; then
                wait_for_deployment
            fi
            ;;
        status)
            show_status
            ;;
        *)
            log_error "Invalid action: $ACTION"
            log_error "Valid actions: apply, dry-run, status"
            exit 1
            ;;
    esac
    
    show_status
    
    log_info "Deployment complete!"
}

main
