#!/bin/bash

# Lovable Clone Backup Script
# This script creates backups of the database and application data

set -e

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
NAMESPACE="lovable-clone"
POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

echo "Starting backup process at $(date)"

# Database backup
echo "Creating database backup..."
kubectl exec -n $NAMESPACE $POSTGRES_POD -- pg_dump -U postgres lovable_clone > $BACKUP_DIR/database_$DATE.sql

# Compress database backup
gzip $BACKUP_DIR/database_$DATE.sql

# Backup persistent volumes
echo "Creating persistent volume backups..."
kubectl get pv -o yaml > $BACKUP_DIR/persistent_volumes_$DATE.yaml

# Backup Kubernetes configurations
echo "Creating Kubernetes configuration backup..."
kubectl get all -n $NAMESPACE -o yaml > $BACKUP_DIR/k8s_resources_$DATE.yaml
kubectl get configmaps -n $NAMESPACE -o yaml > $BACKUP_DIR/configmaps_$DATE.yaml
kubectl get secrets -n $NAMESPACE -o yaml > $BACKUP_DIR/secrets_$DATE.yaml

# Create backup manifest
cat > $BACKUP_DIR/backup_manifest_$DATE.txt << EOF
Backup created: $(date)
Namespace: $NAMESPACE
Database backup: database_$DATE.sql.gz
Kubernetes resources: k8s_resources_$DATE.yaml
ConfigMaps: configmaps_$DATE.yaml
Secrets: secrets_$DATE.yaml
Persistent Volumes: persistent_volumes_$DATE.yaml
EOF

# Upload to cloud storage (example with AWS S3)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    echo "Uploading backup to S3..."
    aws s3 sync $BACKUP_DIR s3://$AWS_S3_BUCKET/backups/$(date +%Y/%m/%d)/
fi

# Clean up old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.yaml" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.txt" -mtime +$RETENTION_DAYS -delete

echo "Backup process completed at $(date)"

# Send notification (example with Slack)
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"✅ Lovable Clone backup completed successfully at '$(date)'"}' \
        $SLACK_WEBHOOK_URL
fi