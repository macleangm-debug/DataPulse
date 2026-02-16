#!/bin/bash
# DataPulse Rollback Script
# Usage: ./rollback.sh [component] [revision]
# Examples:
#   ./rollback.sh backend         # Rollback to previous version
#   ./rollback.sh backend 5       # Rollback to revision 5
#   ./rollback.sh all             # Rollback all components

set -euo pipefail

NAMESPACE="datapulse"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

COMPONENT="${1:-}"
REVISION="${2:-}"

show_history() {
    local deployment=$1
    echo "=== Rollout History for $deployment ==="
    kubectl rollout history deployment/"$deployment" -n $NAMESPACE
    echo ""
}

rollback_deployment() {
    local deployment=$1
    local revision=$2
    
    log_info "Rolling back $deployment..."
    
    show_history "$deployment"
    
    if [[ -n "$revision" ]]; then
        log_info "Rolling back to revision $revision"
        kubectl rollout undo deployment/"$deployment" -n $NAMESPACE --to-revision="$revision"
    else
        log_info "Rolling back to previous version"
        kubectl rollout undo deployment/"$deployment" -n $NAMESPACE
    fi
    
    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/"$deployment" -n $NAMESPACE --timeout=300s
    
    log_info "Rollback complete."
    
    echo ""
    show_history "$deployment"
}

rollback_helm() {
    log_info "Rolling back Helm release..."
    
    echo "=== Helm History ==="
    helm history datapulse -n $NAMESPACE
    echo ""
    
    if [[ -n "$REVISION" ]]; then
        helm rollback datapulse "$REVISION" -n $NAMESPACE
    else
        # Get previous revision
        local prev_rev=$(helm history datapulse -n $NAMESPACE -o json | jq '.[-2].revision')
        helm rollback datapulse "$prev_rev" -n $NAMESPACE
    fi
    
    log_info "Helm rollback complete."
}

case "$COMPONENT" in
    backend)
        rollback_deployment "datapulse-backend" "$REVISION"
        ;;
    frontend)
        rollback_deployment "datapulse-frontend" "$REVISION"
        ;;
    all)
        log_warn "Rolling back all components..."
        rollback_deployment "datapulse-backend" "$REVISION"
        rollback_deployment "datapulse-frontend" "$REVISION"
        ;;
    helm)
        rollback_helm
        ;;
    history)
        show_history "datapulse-backend"
        show_history "datapulse-frontend"
        echo "=== Helm History ==="
        helm history datapulse -n $NAMESPACE 2>/dev/null || echo "No Helm release found"
        ;;
    "")
        echo "Usage: ./rollback.sh [backend|frontend|all|helm|history] [revision]"
        echo ""
        echo "Examples:"
        echo "  ./rollback.sh backend         # Rollback backend to previous"
        echo "  ./rollback.sh backend 5       # Rollback backend to revision 5"
        echo "  ./rollback.sh all             # Rollback all components"
        echo "  ./rollback.sh helm 3          # Rollback Helm release to rev 3"
        echo "  ./rollback.sh history         # Show all rollout history"
        exit 0
        ;;
    *)
        log_error "Unknown component: $COMPONENT"
        exit 1
        ;;
esac

# Show current status
echo ""
echo "=== Current Status ==="
kubectl get pods -n $NAMESPACE -o wide
