#!/bin/bash
# DataPulse Scaling Script
# Usage: ./scale.sh [component] [replicas]
# Examples:
#   ./scale.sh backend 50
#   ./scale.sh frontend 10
#   ./scale.sh auto    # Enable/check autoscaling

set -euo pipefail

NAMESPACE="datapulse"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

COMPONENT="${1:-}"
REPLICAS="${2:-}"

show_current_scale() {
    echo "=== Current Scale ==="
    echo ""
    echo "Deployments:"
    kubectl get deployments -n $NAMESPACE -o custom-columns=NAME:.metadata.name,REPLICAS:.spec.replicas,AVAILABLE:.status.availableReplicas
    echo ""
    echo "HPAs:"
    kubectl get hpa -n $NAMESPACE
    echo ""
    echo "Resource Usage:"
    kubectl top pods -n $NAMESPACE 2>/dev/null || echo "Metrics not available"
}

scale_deployment() {
    local deployment=$1
    local replicas=$2
    
    log_info "Scaling $deployment to $replicas replicas..."
    
    # Check if HPA exists and warn
    if kubectl get hpa "datapulse-${deployment}-hpa" -n $NAMESPACE &>/dev/null; then
        log_warn "HPA exists for $deployment. Manual scaling may be overridden."
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    kubectl scale deployment "datapulse-$deployment" --replicas=$replicas -n $NAMESPACE
    
    log_info "Waiting for scale operation..."
    kubectl rollout status deployment/"datapulse-$deployment" -n $NAMESPACE --timeout=300s
    
    log_info "Scale complete."
}

update_hpa() {
    local component=$1
    local min=$2
    local max=$3
    
    log_info "Updating HPA for $component: min=$min, max=$max"
    
    kubectl patch hpa "datapulse-${component}-hpa" -n $NAMESPACE \
        --type='json' \
        -p="[{\"op\": \"replace\", \"path\": \"/spec/minReplicas\", \"value\": $min}, {\"op\": \"replace\", \"path\": \"/spec/maxReplicas\", \"value\": $max}]"
    
    log_info "HPA updated."
}

case "$COMPONENT" in
    backend)
        if [[ -z "$REPLICAS" ]]; then
            echo "Usage: ./scale.sh backend [replicas]"
            exit 1
        fi
        scale_deployment "backend" "$REPLICAS"
        ;;
    frontend)
        if [[ -z "$REPLICAS" ]]; then
            echo "Usage: ./scale.sh frontend [replicas]"
            exit 1
        fi
        scale_deployment "frontend" "$REPLICAS"
        ;;
    auto)
        log_info "Autoscaling Configuration"
        echo ""
        echo "To update HPA limits:"
        echo "  kubectl patch hpa datapulse-backend-hpa -n $NAMESPACE --type='json' -p='[{\"op\": \"replace\", \"path\": \"/spec/minReplicas\", \"value\": 30}]'"
        echo ""
        echo "Current HPA status:"
        kubectl get hpa -n $NAMESPACE -o yaml
        ;;
    ""|status)
        show_current_scale
        ;;
    *)
        echo "Usage: ./scale.sh [backend|frontend|auto|status] [replicas]"
        exit 1
        ;;
esac

echo ""
show_current_scale
