#!/bin/bash

# Lovable Clone Deployment Script
# This script handles deployment to different environments

set -e

ENVIRONMENT=$1
IMAGE_TAG=${2:-latest}
NAMESPACE="lovable-clone"

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment> [image_tag]"
    echo "Environments: development, staging, production"
    exit 1
fi

case $ENVIRONMENT in
    "development")
        NAMESPACE="lovable-clone-dev"
        KUSTOMIZE_PATH="k8s/environments/development"
        ;;
    "staging")
        NAMESPACE="lovable-clone-staging"
        KUSTOMIZE_PATH="k8s/environments/staging"
        ;;
    "production")
        NAMESPACE="lovable-clone"
        KUSTOMIZE_PATH="k8s/environments/production"
        ;;
    *)
        echo "Invalid environment: $ENVIRONMENT"
        echo "Valid environments: development, staging, production"
        exit 1
        ;;
esac

echo "Deploying to $ENVIRONMENT environment with image tag: $IMAGE_TAG"

# Pre-deployment checks
echo "Running pre-deployment checks..."

# Check if kubectl is configured
if ! kubectl cluster-info > /dev/null 2>&1; then
    echo "Error: kubectl is not configured or cluster is not accessible"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace $NAMESPACE > /dev/null 2>&1; then
    echo "Creating namespace: $NAMESPACE"
    kubectl create namespace $NAMESPACE
fi

# Backup current deployment (for production)
if [ "$ENVIRONMENT" == "production" ]; then
    echo "Creating backup of current deployment..."
    mkdir -p backups/deployments/$(date +%Y%m%d_%H%M%S)
    kubectl get deployment backend -n $NAMESPACE -o yaml > backups/deployments/$(date +%Y%m%d_%H%M%S)/backend.yaml
    kubectl get deployment frontend -n $NAMESPACE -o yaml > backups/deployments/$(date +%Y%m%d_%H%M%S)/frontend.yaml
fi

# Update image tags
echo "Updating image tags..."
cd $KUSTOMIZE_PATH
kustomize edit set image lovable-clone/backend:$IMAGE_TAG
kustomize edit set image lovable-clone/frontend:$IMAGE_TAG
cd - > /dev/null

# Apply configurations
echo "Applying Kubernetes configurations..."
kubectl apply -k $KUSTOMIZE_PATH

# Wait for deployments to be ready
echo "Waiting for deployments to be ready..."
kubectl rollout status deployment/backend -n $NAMESPACE --timeout=600s
kubectl rollout status deployment/frontend -n $NAMESPACE --timeout=600s

# Run health checks
echo "Running health checks..."
sleep 30  # Wait for services to stabilize

# Get service endpoints
BACKEND_SERVICE=$(kubectl get service backend-service -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
FRONTEND_SERVICE=$(kubectl get service frontend-service -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')

# Test backend health
if kubectl run health-check-backend --rm -i --restart=Never --image=curlimages/curl -- curl -f http://$BACKEND_SERVICE:3000/health; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    exit 1
fi

# Test frontend health
if kubectl run health-check-frontend --rm -i --restart=Never --image=curlimages/curl -- curl -f http://$FRONTEND_SERVICE/health; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
    exit 1
fi

# Test database connectivity
echo "Testing database connectivity..."
if kubectl exec deployment/backend -n $NAMESPACE -- node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect().then(() => {
  console.log('Database connection successful');
  process.exit(0);
}).catch((e) => {
  console.error('Database connection failed:', e);
  process.exit(1);
});
"; then
    echo "✅ Database connectivity check passed"
else
    echo "❌ Database connectivity check failed"
    exit 1
fi

# Display deployment status
echo ""
echo "Deployment Summary:"
echo "==================="
echo "Environment: $ENVIRONMENT"
echo "Namespace: $NAMESPACE"
echo "Image Tag: $IMAGE_TAG"
echo "Deployment Time: $(date)"
echo ""

kubectl get pods -n $NAMESPACE
echo ""
kubectl get services -n $NAMESPACE

echo ""
echo "✅ Deployment to $ENVIRONMENT completed successfully!"

# Send notification
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"✅ Lovable Clone deployed successfully to '${ENVIRONMENT}' environment with image tag: '${IMAGE_TAG}'"}' \
        $SLACK_WEBHOOK_URL
fi