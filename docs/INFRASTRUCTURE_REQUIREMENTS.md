# Infrastructure Requirements Checklist

This document outlines all the information, credentials, and decisions needed from stakeholders to fully implement the multi-environment AWS infrastructure.

---

## Table of Contents

1. [AWS Account Setup](#1-aws-account-setup)
2. [Domain & DNS Configuration](#2-domain--dns-configuration)
3. [SSL/TLS Certificates](#3-ssltls-certificates)
4. [Database Configuration](#4-database-configuration)
5. [Storage (S3) Configuration](#5-storage-s3-configuration)
6. [Payment Processing (Adyen)](#6-payment-processing-adyen)
7. [SMS Service (Twilio)](#7-sms-service-twilio)
8. [Email Service (Amazon SES)](#8-email-service-amazon-ses)
9. [Authentication (Google OAuth)](#9-authentication-google-oauth)
10. [Container Registry (ECR)](#10-container-registry-ecr)
11. [Secrets Management](#11-secrets-management)
12. [Observability](#12-observability)
13. [CI/CD Pipeline](#13-cicd-pipeline)
14. [Cost & Billing](#14-cost--billing)

---

## 1. AWS Account Setup

### Required Information

| Item | Description | Example |
|------|-------------|---------|
| AWS Account ID | 12-digit account number | `123456789012` |
| AWS Region (Primary) | Region for all services | `us-east-1` |
| AWS Region (Secondary) | DR region (optional) | `us-west-2` |
| IAM Admin User | User for Terraform | Create new or use existing |

### Decisions Needed

- [ ] **Single vs Multi-Account**: Will you use separate AWS accounts per environment or a single account with resource isolation?
  - **Recommendation**: Single account with separate VPCs per environment (simpler, lower cost)
  - **Alternative**: AWS Organizations with separate accounts (better isolation, more complex)

- [ ] **Terraform State Storage**: Where should Terraform store its state?
  - **Needed**: S3 bucket name for state (e.g., `uplifter-terraform-state`)
  - **Needed**: DynamoDB table name for locking (e.g., `terraform-locks`)

### Credentials Needed

```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Or preferably, IAM role ARN for assumed role access.

---

## 2. Domain & DNS Configuration

### Required Information

| Environment | Domain | Status |
|-------------|--------|--------|
| Production | `uplifterinc.com` | ☐ Owned? ☐ DNS managed where? |
| Staging | `upliftergymnastics.com` | ☐ Owned? ☐ DNS managed where? |
| Development | `uplifterdev.com` | ☐ Owned? ☐ DNS managed where? |

### Decisions Needed

- [ ] **DNS Provider**: Where are domains currently registered/managed?
  - [ ] Route 53 (preferred - easiest integration)
  - [ ] Cloudflare
  - [ ] GoDaddy
  - [ ] Other: ___________

- [ ] **Transfer to Route 53?**: Should we migrate DNS to Route 53 for easier ACM/CloudFront integration?

### Actions Required

For each domain, provide:
1. Domain registrar login credentials OR
2. Ability to add NS records to point to Route 53 OR
3. Access to create DNS records manually

### Route 53 Information Needed (if using)

| Domain | Route 53 Hosted Zone ID |
|--------|------------------------|
| uplifterinc.com | (will be created) |
| upliftergymnastics.com | (will be created) |
| uplifterdev.com | (will be created) |

---

## 3. SSL/TLS Certificates

### Required Information

AWS Certificate Manager (ACM) will be used for SSL certificates. Certificates are **free** but require domain validation.

### Certificates Needed

| Domain | Certificate Type | Region |
|--------|-----------------|--------|
| `*.uplifterinc.com` | Wildcard | us-east-1 (CloudFront) |
| `uplifterinc.com` | Root | us-east-1 (CloudFront) |
| `*.uplifterinc.com` | Wildcard | Primary region (ALB) |
| `*.upliftergymnastics.com` | Wildcard | us-east-1 + Primary |
| `*.uplifterdev.com` | Wildcard | us-east-1 + Primary |

### Decisions Needed

- [ ] **Validation Method**: How will you validate domain ownership?
  - [ ] DNS validation (recommended - add CNAME records)
  - [ ] Email validation (emails sent to admin@domain.com)

---

## 4. Database Configuration

### Required Information

| Item | Production | Staging | Development |
|------|------------|---------|-------------|
| Instance Class | `db.r6g.large` | `db.t4g.small` | `db.t4g.micro` |
| Storage (GB) | 100 | 20 | 20 |
| Multi-AZ | Yes | No | No |
| Read Replica | Yes | No | No |

### Credentials Needed

| Environment | Master Username | Master Password |
|-------------|-----------------|-----------------|
| Production | `uplifter_admin` | (generate secure) |
| Staging | `uplifter_admin` | (generate secure) |
| Development | `uplifter_admin` | (generate secure) |

### Decisions Needed

- [ ] **Password Policy**: Who generates database passwords?
  - [ ] You provide them
  - [ ] We generate and store in Secrets Manager

- [ ] **Backup Retention**:
  - Production: ___ days (recommend: 30)
  - Staging: ___ days (recommend: 7)
  - Development: ___ days (recommend: 1)

---

## 5. Storage (S3) Configuration

### Bucket Names Needed

| Environment | Assets Bucket | Documents Bucket |
|-------------|---------------|------------------|
| Production | `uplifter-assets-prod` | `uplifter-documents-prod` |
| Staging | `uplifter-gymnastics-assets` | `uplifter-gymnastics-docs` |
| Development | `uplifter-assets-dev` | `uplifter-documents-dev` |

**Note**: S3 bucket names must be globally unique. If these names are taken, provide alternatives.

### Decisions Needed

- [ ] **Lifecycle Policies**:
  - Staging assets: Delete after ___ days? (recommend: 30)
  - Development assets: Delete after ___ days? (recommend: 7)

- [ ] **Cross-Region Replication**: Enable for production? (adds cost but improves DR)

---

## 6. Payment Processing (Adyen)

### Required Information

#### Production (LIVE)

| Item | Value |
|------|-------|
| Merchant Account | |
| API Key | |
| Client Key | |
| Webhook HMAC Key | |
| Webhook URL to configure | `https://admin.uplifterinc.com/api/webhooks/adyen` |

#### Test Environment (for Staging/Dev/Local)

| Item | Value |
|------|-------|
| Test Merchant Account | |
| Test API Key | |
| Test Client Key | |
| Test Webhook HMAC Key | |
| Webhook URL (Staging) | `https://admin.upliftergymnastics.com/api/webhooks/adyen` |
| Webhook URL (Dev) | `https://admin.uplifterdev.com/api/webhooks/adyen` |

### Actions Required in Adyen Customer Area

1. [ ] Create webhook endpoint for each environment
2. [ ] Enable HMAC signature verification
3. [ ] Select events to receive (payment notifications, refunds, etc.)

---

## 7. SMS Service (Twilio)

### Required Information

| Item | Value |
|------|-------|
| Account SID | |
| Auth Token | |
| Messaging Service SID | |
| Phone Number (E.164 format) | e.g., `+1234567890` |

### Decisions Needed

- [ ] **A2P 10DLC Registration**: Is your Twilio account registered for A2P 10DLC? (Required for US SMS)

- [ ] **Phone Numbers**:
  - Production: Real phone number
  - Staging/Dev: Use Twilio test/magic numbers?

### Webhook URLs to Configure in Twilio

| Environment | Webhook URL |
|-------------|------------|
| Production | `https://admin.uplifterinc.com/api/webhooks/twilio` |
| Staging | `https://admin.upliftergymnastics.com/api/webhooks/twilio` |
| Development | `https://admin.uplifterdev.com/api/webhooks/twilio` |

---

## 8. Email Service (Amazon SES)

### Required Information

| Item | Production | Staging | Development |
|------|------------|---------|-------------|
| From Email | `noreply@uplifterinc.com` | `noreply@upliftergymnastics.com` | `noreply@uplifterdev.com` |
| Reply-To Email | | | |

### Actions Required

1. [ ] **Verify Domains in SES**:
   - [ ] `uplifterinc.com`
   - [ ] `upliftergymnastics.com`
   - [ ] `uplifterdev.com`

2. [ ] **Request Production Access** (for uplifterinc.com):
   - SES starts in sandbox mode (can only send to verified emails)
   - Production access request requires:
     - Use case description
     - Expected sending volume
     - Bounce/complaint handling plan

3. [ ] **DNS Records** (for each domain):
   - DKIM records (3 CNAME records)
   - SPF record (TXT record)
   - DMARC record (optional but recommended)

### Decisions Needed

- [ ] **Bounce Handling**: How should bounces/complaints be handled?
  - [ ] SNS notifications to webhook
  - [ ] Email notifications to admin
  - [ ] Both

---

## 9. Authentication (Google OAuth)

### Required Information

You need **4 separate OAuth 2.0 Client IDs** (one per environment) because each has different redirect URIs.

#### Production OAuth App

| Item | Value |
|------|-------|
| Client ID | |
| Client Secret | |
| Redirect URI | `https://login.uplifterinc.com/api/auth/callback/google` |

#### Staging OAuth App

| Item | Value |
|------|-------|
| Client ID | |
| Client Secret | |
| Redirect URI | `https://login.upliftergymnastics.com/api/auth/callback/google` |

#### Development OAuth App

| Item | Value |
|------|-------|
| Client ID | |
| Client Secret | |
| Redirect URI | `https://login.uplifterdev.com/api/auth/callback/google` |

#### Local OAuth App

| Item | Value |
|------|-------|
| Client ID | |
| Client Secret | |
| Redirect URI | `http://localhost:3000/api/auth/callback/google` |

### Actions Required in Google Cloud Console

1. [ ] Create 4 OAuth 2.0 Client IDs (Web application type)
2. [ ] Add authorized redirect URIs for each
3. [ ] Configure OAuth consent screen
4. [ ] Verify domain ownership (for production)

---

## 10. Container Registry (ECR)

### Required Information

| Item | Value |
|------|-------|
| Repository Name | `uplifter` |
| Image Scanning | Enable on push? (recommended) |
| Lifecycle Policy | Keep last ___ images (recommend: 30) |

### Decisions Needed

- [ ] **Cross-Account Access**: Will CI/CD run from a different AWS account?

---

## 11. Secrets Management

### Secrets to Store (per environment)

All sensitive values should be stored in AWS Secrets Manager:

| Secret Name | Contains |
|-------------|----------|
| `uplifter/{env}/database` | `DATABASE_URL`, `DB_PASSWORD` |
| `uplifter/{env}/auth` | `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| `uplifter/{env}/adyen` | `ADYEN_API_KEY`, `ADYEN_WEBHOOK_HMAC_KEY`, `NEXT_PUBLIC_ADYEN_CLIENT_KEY` |
| `uplifter/{env}/twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |

### Decisions Needed

- [ ] **Secret Rotation**: Enable automatic rotation for database passwords?
- [ ] **Access Pattern**: 
  - [ ] ECS Task retrieves secrets at startup
  - [ ] External Secrets Operator syncs to Kubernetes (for EKS)

---

## 12. Observability

### Groundcover (for EKS - Phase 3)

| Item | Value |
|------|-------|
| Groundcover API Key | (sign up at groundcover.com) |
| Cluster Name | `uplifter-production` |

### CloudWatch (for ECS - Phase 2)

| Item | Value |
|------|-------|
| Log Retention | ___ days (recommend: 30 for prod, 7 for others) |
| Alarm SNS Topic | Email address for alerts: |

### Decisions Needed

- [ ] **Alert Recipients**: Who receives infrastructure alerts?
  - Email: ___________
  - Slack webhook (optional): ___________
  - PagerDuty (optional): ___________

---

## 13. CI/CD Pipeline

### GitHub Actions

| Item | Value |
|------|-------|
| Repository | `github.com/___/uplifter` |
| Branch Strategy | `main` → production, `develop` → development |

### Secrets Needed in GitHub

| Secret Name | Purpose |
|-------------|---------|
| `AWS_ACCESS_KEY_ID` | ECR push, ECS deploy |
| `AWS_SECRET_ACCESS_KEY` | ECR push, ECS deploy |
| `AWS_REGION` | Target region |
| `ECR_REPOSITORY` | ECR repository URI |

### Decisions Needed

- [ ] **Deployment Strategy**:
  - [ ] Push to `main` auto-deploys to production
  - [ ] Push to `main` deploys to staging, manual promotion to production
  - [ ] Manual deployment only

- [ ] **Branch Protection**: Enable required reviews for `main`?

---

## 14. Cost & Billing

### Estimated Monthly Costs

| Component | Production | Staging | Development | Total |
|-----------|------------|---------|-------------|-------|
| ECS/EKS | $200-800 | $50-100 | $20-50 | |
| RDS | $150-300 | $30-50 | $15-25 | |
| ElastiCache | $50-150 | $15-30 | $0 (Upstash) | |
| S3 + CloudFront | $50-150 | $10-20 | $5-10 | |
| NAT Gateway | $90 | $45 | $45 | |
| Other (Secrets, Logs) | $20-50 | $10-20 | $5-10 | |
| **Estimated Total** | **$560-1,540** | **$160-265** | **$90-140** | **$810-1,945** |

### Decisions Needed

- [ ] **Budget Alerts**: Set up alerts at what thresholds?
  - 50% of budget: ☐ Yes ☐ No
  - 80% of budget: ☐ Yes ☐ No
  - 100% of budget: ☐ Yes ☐ No

- [ ] **Reserved Instances**: Purchase 1-year reserved capacity for:
  - [ ] RDS (saves ~30%)
  - [ ] ElastiCache (saves ~30%)
  - [ ] Not now, evaluate after 3 months

- [ ] **Spot Instances**: Use Fargate Spot for production?
  - [ ] Yes (saves 60-70% but can be interrupted)
  - [ ] No (guaranteed capacity)
  - [ ] Hybrid (30% on-demand, 70% spot - recommended)

---

## Summary Checklist

### Immediate Requirements (Before Phase 1)

- [ ] AWS account access with admin permissions
- [ ] Domain ownership confirmation for all 3 domains
- [ ] DNS management access (or decision to migrate to Route 53)
- [ ] Decision on single vs multi-account strategy

### Phase 1 Requirements (Foundation)

- [ ] Database master passwords (or let us generate)
- [ ] S3 bucket names confirmed (or alternatives if taken)
- [ ] ACM certificate validation method chosen

### Phase 2 Requirements (ECS Deployment)

- [ ] All Adyen credentials (test and live)
- [ ] All Twilio credentials
- [ ] Google OAuth apps created (4 environments)
- [ ] SES domains verified
- [ ] GitHub Actions secrets configured

### Phase 3 Requirements (EKS Migration)

- [ ] Groundcover account created
- [ ] ArgoCD admin password preference
- [ ] Kubernetes namespace naming confirmed

---

## Next Steps

1. Review this document and fill in all required information
2. Make decisions on items marked with checkboxes
3. Create accounts/credentials for external services
4. Schedule infrastructure deployment kickoff

**Questions?** Contact the engineering team.
