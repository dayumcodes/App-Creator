# Lovable Clone - Production Deployment Guide

This document provides comprehensive instructions for deploying the Lovable Clone application to production environments.

## Overview

The deployment configuration includes:
- Docker containers for frontend and backend
- Kubernetes manifests for scalability
- Environment-specific configurations
- Monitoring and alerting systems
- Backup and disaster recovery procedures
- Security hardening and vulnerability scanning
- Automated CI/CD pipeline with rollback capabilities

## Prerequisites

- Docker and Docker Compose
- Kubernetes cluster (1.20+)
- kubectl configured
- Helm (optional, for package management)
- GitHub Actions (for CI/CD)
- Container registry access (GitHub Container Registry)

## Quick Start

### 1. Local Development with Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd lovable-clone

# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Kubernetes Deployment

#### Development Environment
```bash
# Apply development configuration
kubectl apply -k k8s/environments/development

# Check deployment status
kubectl get pods -n lovable-clone-dev
```

#### Staging Environment
```bash
# Apply staging configuration
kubectl apply -k k8s/environments/staging

# Check deployment status
kubectl get pods -n lovable-clone-staging
```

#### Production Environment
```bash
# Apply production configuration
kubectl apply -k k8s/environments/production

# Check deployment status
kubectl get pods -n lovable-clone
```

## Environment Configuration

### Environment Variables

#### Backend Configuration
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/database
REDIS_URL=redis://host:6379
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-api-key
PORT=3000
```

#### Frontend Configuration
```bash
VITE_API_URL=https://api.lovable-clone.com
VITE_WS_URL=wss://api.lovable-clone.com
```

### Secrets Management

Update the Kubernetes secrets:
```bash
# Create secrets
kubectl create secret generic lovable-secrets \
  --from-literal=JWT_SECRET=your-jwt-secret \
  --from-literal=OPENAI_API_KEY=your-openai-api-key \
  --from-literal=POSTGRES_PASSWORD=your-postgres-password \
  -n lovable-clone

# Update existing secrets
kubectl patch secret lovable-secrets \
  -p='{"data":{"JWT_SECRET":"'$(echo -n 'new-secret' | base64)'"}}' \
  -n lovable-clone
```

## Deployment Scripts

### Manual Deployment
```bash
# Deploy to specific environment
./scripts/deploy.sh production latest

# Deploy with specific image tag
./scripts/deploy.sh staging v1.2.3
```

### Automated Deployment (CI/CD)

The GitHub Actions workflow automatically:
1. Runs tests and security scans
2. Builds and pushes Docker images
3. Deploys to staging on `develop` branch
4. Deploys to production on `main` branch
5. Runs health checks and rollback on failure

## Monitoring and Alerting

### Prometheus Metrics
- Application metrics: `http://prometheus:9090`
- Custom metrics endpoint: `/api/performance/metrics`

### Grafana Dashboards
- Main dashboard: `http://grafana:3000`
- Default credentials: admin/admin123

### Alert Rules
- High CPU usage (>80% for 5 minutes)
- High memory usage (>85% for 5 minutes)
- Pod crash looping
- Service down
- High error rate (>10% for 5 minutes)

### Setting up Alerts
```bash
# Configure Slack notifications
kubectl patch secret lovable-secrets \
  -p='{"data":{"SLACK_WEBHOOK_URL":"'$(echo -n 'your-webhook-url' | base64)'"}}' \
  -n lovable-clone

# Configure email notifications
kubectl patch configmap alertmanager-config \
  --patch='{"data":{"config.yml":"..."}}' \
  -n lovable-clone
```

## Backup and Recovery

### Automated Backups
Backups run daily at 2 AM via CronJob:
```bash
# Check backup status
kubectl get cronjobs -n lovable-clone

# Manual backup
kubectl create job --from=cronjob/backup-job manual-backup-$(date +%s) -n lovable-clone
```

### Restore from Backup
```bash
# List available backups
ls -la /backups/

# Restore from specific backup
./scripts/restore.sh 20240131_143000
```

### Disaster Recovery
```bash
# Test disaster recovery procedures
./scripts/disaster-recovery.sh test

# Failover to secondary cluster
./scripts/disaster-recovery.sh failover

# Failback to primary cluster
./scripts/disaster-recovery.sh failback

# Check DR status
./scripts/disaster-recovery.sh status
```

## Security

### Network Policies
Network policies restrict traffic between pods:
- Frontend can only communicate with backend
- Backend can only communicate with database and Redis
- Database accepts connections only from backend

### Pod Security Policies
- Run as non-root user
- Read-only root filesystem
- Drop all capabilities
- No privilege escalation

### Vulnerability Scanning
Automated security scans run daily:
```bash
# Check scan results
kubectl logs -l app=security-scan -n lovable-clone

# Manual security scan
kubectl create job --from=cronjob/security-scan manual-scan-$(date +%s) -n lovable-clone
```

## Scaling

### Horizontal Pod Autoscaler
Backend automatically scales based on CPU and memory:
- Min replicas: 3
- Max replicas: 10
- CPU threshold: 70%
- Memory threshold: 80%

### Manual Scaling
```bash
# Scale backend
kubectl scale deployment backend --replicas=5 -n lovable-clone

# Scale frontend
kubectl scale deployment frontend --replicas=3 -n lovable-clone
```

## Troubleshooting

### Common Issues

#### Pod Startup Issues
```bash
# Check pod status
kubectl get pods -n lovable-clone

# View pod logs
kubectl logs <pod-name> -n lovable-clone

# Describe pod for events
kubectl describe pod <pod-name> -n lovable-clone
```

#### Database Connection Issues
```bash
# Test database connectivity
kubectl exec deployment/backend -n lovable-clone -- node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect().then(() => console.log('Connected')).catch(console.error);
"
```

#### Service Discovery Issues
```bash
# Check service endpoints
kubectl get endpoints -n lovable-clone

# Test service connectivity
kubectl run test-pod --rm -i --restart=Never --image=curlimages/curl -- curl -f http://backend-service:3000/health
```

### Health Checks

#### Application Health
```bash
# Backend health
curl http://backend-service:3000/health

# Frontend health
curl http://frontend-service/health
```

#### Database Health
```bash
# PostgreSQL health
kubectl exec deployment/postgres -n lovable-clone -- pg_isready -U postgres

# Redis health
kubectl exec deployment/redis -n lovable-clone -- redis-cli ping
```

## Performance Optimization

### Resource Limits
Adjust resource limits based on usage:
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

### Caching
- Redis for session storage and caching
- CDN for static assets
- Database query optimization

### Database Optimization
```bash
# Run database migrations
kubectl exec deployment/backend -n lovable-clone -- npm run migrate

# Optimize database
kubectl exec deployment/postgres -n lovable-clone -- psql -U postgres -c "VACUUM ANALYZE;"
```

## Rollback Procedures

### Automatic Rollback
The CI/CD pipeline automatically rolls back on health check failures.

### Manual Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n lovable-clone
kubectl rollout undo deployment/frontend -n lovable-clone

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n lovable-clone

# Check rollout status
kubectl rollout status deployment/backend -n lovable-clone
```

## Maintenance

### Regular Maintenance Tasks
1. Update dependencies monthly
2. Review and rotate secrets quarterly
3. Update base images for security patches
4. Review and optimize resource usage
5. Test disaster recovery procedures quarterly

### Updating the Application
```bash
# Update to new version
./scripts/deploy.sh production v1.3.0

# Monitor deployment
kubectl rollout status deployment/backend -n lovable-clone
kubectl rollout status deployment/frontend -n lovable-clone
```

## Support and Monitoring

### Logs
```bash
# Application logs
kubectl logs -f deployment/backend -n lovable-clone
kubectl logs -f deployment/frontend -n lovable-clone

# System logs
kubectl logs -f deployment/prometheus -n lovable-clone
kubectl logs -f deployment/grafana -n lovable-clone
```

### Metrics
- Application metrics: `/api/performance/metrics`
- System metrics: Prometheus + Grafana
- Custom dashboards for business metrics

### Alerts
- Slack notifications for critical issues
- Email notifications for warnings
- PagerDuty integration for on-call support

## Security Checklist

- [ ] Secrets are properly encrypted and rotated
- [ ] Network policies are in place
- [ ] Pod security policies are enforced
- [ ] Regular vulnerability scans are running
- [ ] HTTPS is enforced with valid certificates
- [ ] Database connections are encrypted
- [ ] Backup encryption is enabled
- [ ] Access logs are monitored
- [ ] Security patches are applied regularly

## Contact Information

For deployment issues or questions:
- DevOps Team: devops@lovable-clone.com
- On-call Support: +1-555-0123
- Documentation: https://docs.lovable-clone.com
- Status Page: https://status.lovable-clone.com