#!/bin/bash

# Lovable Clone Disaster Recovery Script
# This script handles disaster recovery scenarios

set -e

NAMESPACE="lovable-clone"
BACKUP_DIR="/backups"
DR_MODE=$1

case $DR_MODE in
    "failover")
        echo "Initiating failover to secondary cluster..."
        
        # Update DNS to point to secondary cluster
        # This would typically involve updating your DNS provider
        echo "Updating DNS records..."
        
        # Scale up secondary cluster
        kubectl config use-context secondary-cluster
        kubectl scale deployment backend --replicas=3 -n $NAMESPACE
        kubectl scale deployment frontend --replicas=2 -n $NAMESPACE
        
        # Verify secondary cluster is healthy
        kubectl wait --for=condition=available deployment/backend -n $NAMESPACE --timeout=300s
        kubectl wait --for=condition=available deployment/frontend -n $NAMESPACE --timeout=300s
        
        echo "Failover completed successfully"
        ;;
        
    "failback")
        echo "Initiating failback to primary cluster..."
        
        # Ensure primary cluster is healthy
        kubectl config use-context primary-cluster
        kubectl get nodes
        
        # Restore latest backup to primary cluster
        LATEST_BACKUP=$(ls -t $BACKUP_DIR/database_*.sql.gz | head -1 | sed 's/.*database_\(.*\)\.sql\.gz/\1/')
        ./restore.sh $LATEST_BACKUP
        
        # Update DNS to point back to primary cluster
        echo "Updating DNS records back to primary..."
        
        # Scale down secondary cluster
        kubectl config use-context secondary-cluster
        kubectl scale deployment backend --replicas=0 -n $NAMESPACE
        kubectl scale deployment frontend --replicas=0 -n $NAMESPACE
        
        echo "Failback completed successfully"
        ;;
        
    "test")
        echo "Running disaster recovery test..."
        
        # Test backup integrity
        echo "Testing backup integrity..."
        LATEST_BACKUP=$(ls -t $BACKUP_DIR/database_*.sql.gz | head -1)
        if [ -f "$LATEST_BACKUP" ]; then
            gunzip -t "$LATEST_BACKUP"
            echo "✅ Latest backup is valid"
        else
            echo "❌ No backup found"
            exit 1
        fi
        
        # Test secondary cluster connectivity
        echo "Testing secondary cluster..."
        kubectl config use-context secondary-cluster
        kubectl get nodes
        kubectl get pods -n $NAMESPACE
        echo "✅ Secondary cluster is accessible"
        
        # Test monitoring systems
        echo "Testing monitoring systems..."
        curl -f http://prometheus-service:8080/-/healthy || echo "❌ Prometheus not healthy"
        curl -f http://grafana-service:3000/api/health || echo "❌ Grafana not healthy"
        
        echo "Disaster recovery test completed"
        ;;
        
    "status")
        echo "Disaster Recovery Status Report"
        echo "================================"
        
        # Check backup status
        echo "Latest backups:"
        ls -la $BACKUP_DIR/database_*.sql.gz | tail -5
        
        # Check cluster health
        echo -e "\nPrimary cluster status:"
        kubectl config use-context primary-cluster
        kubectl get nodes
        kubectl get pods -n $NAMESPACE
        
        echo -e "\nSecondary cluster status:"
        kubectl config use-context secondary-cluster
        kubectl get nodes
        kubectl get pods -n $NAMESPACE
        
        # Check monitoring
        echo -e "\nMonitoring status:"
        kubectl config use-context primary-cluster
        kubectl get pods -n $NAMESPACE -l app=prometheus
        kubectl get pods -n $NAMESPACE -l app=grafana
        ;;
        
    *)
        echo "Usage: $0 {failover|failback|test|status}"
        echo ""
        echo "Commands:"
        echo "  failover  - Switch to secondary cluster"
        echo "  failback  - Switch back to primary cluster"
        echo "  test      - Test disaster recovery procedures"
        echo "  status    - Show disaster recovery status"
        exit 1
        ;;
esac