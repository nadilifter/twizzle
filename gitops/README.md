# GitOps Repository Structure

This directory contains ArgoCD application definitions for managing Uplifter deployments across environments.

## Directory Structure

```
gitops/
├── apps/
│   ├── production/
│   │   └── application.yaml    # ArgoCD Application for production
│   ├── staging/
│   │   └── application.yaml    # ArgoCD Application for staging
│   └── development/
│       └── application.yaml    # ArgoCD Application for development
└── base/
    └── (shared configurations if needed)
```

## How It Works

1. **GitHub Actions** builds and pushes Docker images to ECR
2. **ArgoCD Image Updater** detects new images and updates the manifests
3. **ArgoCD** syncs the new configuration to the Kubernetes cluster
4. **Groundcover** automatically monitors the new deployment

## Deployment Flow

```
Push to main → Build Image → Push to ECR → ArgoCD Detects → Deploy to EKS
```

## Environment Mapping

| Branch    | Environment   | Domain                    | ArgoCD App              |
|-----------|---------------|---------------------------|-------------------------|
| main      | production    | uplifterinc.com          | uplifter-production     |
| main      | staging       | upliftergymnastics.com   | uplifter-staging        |
| develop   | development   | uplifterdev.com          | uplifter-development    |

## Initial Setup

1. Install ArgoCD in your EKS cluster
2. Configure ArgoCD to watch this repository
3. Apply the application manifests:

```bash
kubectl apply -f gitops/apps/production/application.yaml
kubectl apply -f gitops/apps/staging/application.yaml
kubectl apply -f gitops/apps/development/application.yaml
```

## Secrets Management

Secrets are managed via AWS Secrets Manager and injected into Kubernetes using External Secrets Operator.

See `infrastructure/` for the Terraform configuration that creates the necessary secrets.

## Manual Sync

To manually sync an environment:

```bash
argocd app sync uplifter-production
argocd app sync uplifter-staging
argocd app sync uplifter-development
```

## Rollback

To rollback to a previous version:

```bash
argocd app rollback uplifter-production
```

Or specify a specific revision:

```bash
argocd app sync uplifter-production --revision <commit-sha>
```
