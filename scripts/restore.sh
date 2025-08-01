#!/bin/bash

# Lovable Clone Restore Script
# This script restores the application from backup

set -e

# Configuration
BACKUP_DIR="/backups"
NAMESPACE="lovable-clone"
RESTORE_DATE=$1

if [ -z "$RESTORE_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Example: $0 20240131_143000"
    exit 1
fi

echo "Starting restore process for backup: $RESTORE_DATE"

# Verify backup files exist
if [ ! -f "$BACKUP_DIR/database_$RESTORE_DATE.sql.gz" ]; then
    echo "Error: Database backup file not found: $BACKUP_DIR/database_$RESTORE_DATE.sql.gz"
    exit 1
fi

# Scale down applications
echo "Scaling down applications..."
kubectl scale deployment backend --replicas=0 -n $NAMESPACE
kubectl scale deployment frontend --replicas=0 -n $NAMESPACE

# Wait for pods to terminate
echo "Waiting for pods to terminate..."
kubectl wait --for=delete pod -l app=backend -n $NAMESPACE --timeout=300s
kubectl wait --for=delete pod -l app=frontend -n $NAMESPACE --timeout=300s

# Restore database
echo "Restoring database..."
POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')

# Drop and recreate database
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -c "DROP DATABASE IF EXISTS lovable_clone;"
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -c "CREATE DATABASE lovable_clone;"

# Restore database from backup
gunzip -c $BACKUP_DIR/database_$RESTORE_DATE.sql.gz | kubectl exec -i -n $NAMESPACE $POSTGRES_POD -- psql -U postgres lovable_clone

# Restore Kubernetes resources if needed
if [ -f "$BACKUP_DIR/configmaps_$RESTORE_DATE.yaml" ]; then
    echo "Restoring ConfigMaps..."
    kubectl apply -f $BACKUP_DIR/configmaps_$RESTORE_DATE.yaml
fi

# Scale up applications
echo "Scaling up applications..."
kubectl scale deployment backend --replicas=3 -n $NAMESPACE
kubectl scale deployment frontend --replicas=2 -n $NAMESPACE

# Wait for applications to be ready
echo "Waiting for applications to be ready..."
kubectl wait --for=condition=available deployment/backend -n $NAMESPACE --timeout=300s
kubectl wait --for=condition=available deployment/frontend -n $NAMESPACE --timeout=300s

# Verify restore
echo "Verifying restore..."
kubectl get pods -n $NAMESPACE

echo "Restore process completed at $(date)"

# Send notification
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"✅ Lovable Clone restore completed successfully at '$(date)' from backup: '${RESTORE_DATE}'"}' \
        $SLACK_WEBHOOK_URL
fi