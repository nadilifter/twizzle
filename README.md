# Uplifter

## Overview

This repository is for our app focused on US gymnastics. It is intentionally opinionated, modern by default, and designed to scale from early-stage experimentation to serious production workloads.

---

## What This Repo Is

* A long-lived **monorepo foundation** for our vertical SaaS business focused on US gymnastics
* Designed based on standard B2B software practices
* Built to handle high transaction volume, burst traffic, and evolving product needs

## What This Repo Is Not

* Not an open-source starter
* Not intended for one-off experiments
* Not designed to avoid complexity at the cost of future scale

---

## Core Principles

1. **Modern by Default**

   * We use current, well-supported frameworks and tooling.
   * If something becomes obsolete, we replace it.

2. **Integration First**

   * External, best-in-class services are preferred over internal builds.
   * Payments, UI primitives, infrastructure, and tooling should be integrated, not reinvented.

3. **Built Fast, Scales Hard**

   * Early velocity matters.
   * Architectural decisions must still support:

     * Hundreds of millions of dollars in transactions
     * Tens of thousands of concurrent users
     * Large, time-sensitive traffic spikes

---

## Technology Stack

* **Language**: TypeScript (100%)
* **Frontend Framework**: Next.js 14+ (App Router)
* **UI System**: Shadcn UI + Tailwind CSS
* **Database**: PostgreSQL 16 (RDS in cloud, Docker locally)
* **Caching**: Redis (ElastiCache in cloud, Docker locally)
* **Payments**: Adyen
* **SMS**: Twilio
* **Email**: Amazon SES (cloud), MailHog (local)
* **Storage**: S3 (cloud), MinIO (local)
* **Authentication**: NextAuth.js with Google OAuth
* **Containers**: Docker, ECS Fargate, EKS
* **Infrastructure**: Terraform, Helm, ArgoCD (planned)
* **Environment**: Linux / WSL-first development

---

## Multi-Environment Architecture

The platform operates across four distinct environments:

| Environment   | Domain                    | Purpose                         |
|---------------|---------------------------|---------------------------------|
| Production    | `uplifterinc.com`        | Live customer traffic           |
| Staging       | `upliftergymnastics.com` | QA/UAT testing                  |
| Development   | `uplifterdev.com`        | Development testing             |
| Local         | `*.localhost:3000`       | Local development               |

### Environment Configuration

Set the `APP_ENVIRONMENT` variable to control environment-specific behavior:

```bash
APP_ENVIRONMENT=local      # Default for local development
APP_ENVIRONMENT=development
APP_ENVIRONMENT=staging
APP_ENVIRONMENT=production
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `src/lib/env-domains.ts` | Domain configuration per environment |
| `src/lib/storage.ts` | S3/MinIO storage abstraction |
| `src/lib/email.ts` | SES/MailHog email service |
| `src/lib/services-config.ts` | External service configuration |

---

## Repository Structure

### Application Code

* `src/app/` - Next.js App Router pages and API routes
  * `dashboard/` - Admin portal pages
  * `superadmin/` - Super admin portal
  * `sites/[slug]/` - Tenant marketing sites
  * `api/` - API routes including webhooks

* `src/lib/` - Shared libraries and utilities
  * `env-domains.ts` - Environment configuration
  * `storage.ts` - S3/MinIO abstraction
  * `email.ts` - SES/MailHog email service
  * `services-config.ts` - External service config
  * `webhooks.ts` - Webhook URL management
  * `auth.ts` - NextAuth configuration
  * `db.ts` - Prisma database client

* `src/components/` - Shared React components (Shadcn UI)

### Infrastructure

* `infrastructure/` - Terraform modules and environments
  * `modules/` - Reusable Terraform modules
    * `vpc/` - VPC, subnets, NAT gateways
    * `rds/` - PostgreSQL with read replicas
    * `elasticache/` - Redis cluster
    * `s3/` - Assets and documents buckets
    * `cloudfront/` - CDN distribution
    * `alb/` - Application load balancer
    * `ecs/` - ECS Fargate cluster
    * `eks/` - EKS cluster with ArgoCD
  * `environments/` - Per-environment configurations
    * `production/`
    * `staging/`
    * `development/`

* `charts/uplifter/` - Helm chart for Kubernetes
  * `values.yaml` - Default values
  * `values-production.yaml`
  * `values-staging.yaml`
  * `values-development.yaml`

* `gitops/` - ArgoCD application definitions
  * `apps/production/`
  * `apps/staging/`
  * `apps/development/`

### Database

* `prisma/` - Database schema and migrations
  * `schema.prisma` - Prisma schema
  * `migrations/` - Database migrations
  * `seed.ts` - Database seeding

### Scripts and Tooling

* `scripts/` - Developer utility scripts
  * `check-schema-drift.sh` - Detects schema/migration drift (see below)
  * `deploy-staging.sh` - Staging deployment helper
  * `secrets-decrypt.sh` / `secrets-encrypt.sh` / `secrets-edit.sh` - Secrets management
  * `provision-adyen.ts` - Provisions Adyen API credentials, webhooks, and HMAC keys for any environment via the Management API (run with `npx tsx scripts/provision-adyen.ts --env staging`)
  * `provision-adyen-staging.ts` - (Legacy) Staging-only Adyen webhook provisioning; use `provision-adyen.ts` instead
  * `migrate-states.ts` - One-time migration that converts full state/province names (e.g. "Virginia") to 2-letter ISO codes (e.g. "VA") across all address tables
* `.husky/` - Git hooks
  * `pre-commit` - Blocks commits that modify `schema.prisma` without a corresponding migration

---

## Schema Management

We use [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate) for all database schema changes. Every change to `prisma/schema.prisma` **must** have a corresponding migration under `prisma/migrations/`.

### Workflow

1. Edit `prisma/schema.prisma`
2. Run `pnpm db:migrate` to generate and apply the migration
3. Commit both `schema.prisma` and the new migration directory together

### Drift Detection

Schema drift (changes in `schema.prisma` that have no matching migration) has caused deployment failures in the past. Two safeguards are now in place:

**Pre-commit hook** — If `prisma/schema.prisma` is staged for commit but no files under `prisma/migrations/` are also staged, the commit is blocked. Bypass for WIP commits with:

```bash
SKIP_SCHEMA_CHECK=1 git commit -m "wip: ..."
```

**Manual check** — Run at any time to compare the schema file against the full migration history:

```bash
pnpm db:check
```

This uses `prisma migrate diff` under the hood and exits non-zero if there is un-migrated SQL, printing exactly what is missing.

### Common Pitfalls

* **PostgreSQL enum values**: Adding a new value to a Prisma enum and referencing it in a `DEFAULT` clause in the same migration will fail. PostgreSQL requires `ALTER TYPE ... ADD VALUE` to be committed before the new value can be used. Split the `ADD VALUE` into its own prior migration.
* **`db:push` is for local experimentation only**: It syncs the schema without creating migration files and should never be used as part of the deploy pipeline. The dev Docker container and all deployed environments use `prisma migrate dev` / `prisma migrate deploy`.

---

## Tenant Isolation

The platform is multi-tenant: every organization's data must be isolated from every other organization's data. The current user's organization is determined by `session.user.organizationId` from the NextAuth JWT.

### Enforcement Mechanism

`getScopedDb(organizationId)` in `src/lib/db.ts` returns a Prisma client extension that automatically injects `organizationId` filters into all read, create, update, and delete operations for models listed in the `TENANT_MODELS` array. All API routes should use `getScopedDb` instead of the raw `db` import for tenant-scoped models.

### Key Rules

* **Never trust client-provided `organizationId`** — always use `session.user.organizationId`
* **Mutations must be scoped**, not just reads — do not check ownership then mutate by `{ id }` alone
* **Models without a direct `organizationId`** (e.g. `Payment`, `Enrollment`) must be filtered through their relation chain (e.g. `invoice: { organizationId }`)
* **`AthleteMedicalInfo`** is intentionally shared across organizations as athletes often participate in multiple organizations
* **Platform-level models** (`OrganizationSubscription`, `OrganizationFeatureOverride`, `OrganizationPaymentMethod`, `AdyenPlatformAccount`, `OrganizationStatusLog`) are managed by superadmins and excluded from tenant scoping

See `src/app/api/README.md` for detailed API development conventions and scoping patterns.

---

## Development

### Prerequisites

* Node.js (LTS)
* pnpm (Use `corepack enable` or `npm i -g pnpm`)
* Docker and Docker Compose
* Linux or WSL environment

### Quick Start

```bash
# Install dependencies
pnpm install

# Start local services (PostgreSQL, Redis, MinIO, MailHog)
docker compose up -d db redis minio mailhog

# For the lazy developer: 
docker compose up -d db redis minio mailhog && pnpm dev

# Run database migrations
pnpm db:migrate

# Seed the database (optional)
pnpm db:seed

# Run in development mode
pnpm dev
```

### Common Commands

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Database commands
pnpm db:migrate   # Run migrations (use this, not db:push)
pnpm db:check     # Detect schema drift (schema.prisma vs migrations)
pnpm db:studio    # Open Prisma Studio
pnpm db:seed      # Seed database
pnpm db:reset     # Reset database
pnpm db:push      # Push schema directly (local experimentation only)
```

### Local Services (docker-compose)

| Service   | Port  | Purpose                          |
|-----------|-------|----------------------------------|
| PostgreSQL| 5434  | Database                         |
| Redis     | 6379  | Caching                          |
| MinIO     | 9000  | S3-compatible storage (API)      |
| MinIO     | 9001  | MinIO Console                    |
| MailHog   | 1025  | SMTP server                      |
| MailHog   | 8025  | Email web UI                     |

```bash
# Start all local services
docker compose up -d

# View MailHog emails
open http://localhost:8025

# View MinIO console
open http://localhost:9001  # Login: minioadmin/minioadmin
```

### Local Subdomain Development

To develop locally with the multi-portal architecture, you must update your `/etc/hosts` file (Linux/macOS) or `hosts` file (Windows) to map the subdomains to localhost.

**Add these lines:**
```
127.0.0.1   uplifterinc.localhost
127.0.0.1   login.uplifterinc.localhost
127.0.0.1   startup.uplifterinc.localhost
127.0.0.1   admin.uplifterinc.localhost
127.0.0.1   superadmin.uplifterinc.localhost
127.0.0.1   coach.uplifterinc.localhost
127.0.0.1   athletes.uplifterinc.localhost
127.0.0.1   pos.uplifterinc.localhost
127.0.0.1   feedback.uplifterinc.localhost
127.0.0.1   events.uplifterinc.localhost
127.0.0.1   competitions.uplifterinc.localhost
127.0.0.1   results.uplifterinc.localhost
127.0.0.1   demo-gym.uplifterinc.localhost
```

**Access Points:**
-   **Login Portal**: `http://login.uplifterinc.localhost:3000` - Centralized authentication
-   **Organization Startup**: `http://startup.uplifterinc.localhost:3000` - New organization registration (supports URL parameters for partner referrals)
-   **Super Admin**: `http://superadmin.uplifterinc.localhost:3000`
-   **Business Dashboard**: `http://admin.uplifterinc.localhost:3000`
-   **Coach Portal**: `http://coach.uplifterinc.localhost:3000`
-   **Athlete Portal**: `http://athletes.uplifterinc.localhost:3000`
-   **POS**: `http://pos.uplifterinc.localhost:3000`
-   **Feedback**: `http://feedback.uplifterinc.localhost:3000`
-   **Events Portal**: `http://events.uplifterinc.localhost:3000` - Day-of-event operations (QR check-in, athlete search, schedule)
-   **Competitions Portal**: `http://competitions.uplifterinc.localhost:3000` - Competition browsing and management (planned)
-   **Results Portal**: `http://results.uplifterinc.localhost:3000` - Competition results and scores (planned)
-   **Tenant Site 1**: `http://demo-gym.uplifterinc.localhost:3000`
-   **Tenant Site 2**: `http://londonwestern.uplifterinc.localhost:3000`

### Authentication Architecture

Authentication is centralized at `login.uplifterinc.com` (production) or `login.uplifterinc.localhost:3000` (local).

**How it works:**
1. All protected portals redirect unauthenticated users to the login portal
2. After successful login, users are redirected back to the original portal via `callbackUrl`
3. Session cookies are shared across all subdomains via the `.uplifterinc.com` cookie domain

**Google OAuth (Local Development):**
Google doesn't allow subdomains on localhost (e.g., `login.uplifterinc.localhost`) as OAuth redirect URIs. To work around this:
1. OAuth callbacks go through `localhost:3000` (which Google accepts)
2. The `oauth-bridge` endpoint creates a signed bridge token
3. The `session-bridge` endpoint sets the session cookie on the correct domain
4. User is redirected to their original destination

**Google OAuth (Production):**
Configure these redirect URIs in Google Cloud Console:
- `https://login.uplifterinc.com/api/auth/callback/google`

Turborepo task filtering should be used sparingly and intentionally. Default workflows should remain simple.

---

## Deployment

### Infrastructure (Terraform)

All AWS infrastructure is defined in `infrastructure/` using reusable Terraform modules.

```bash
cd infrastructure/environments/production

# Initialize Terraform
terraform init

# Plan changes
terraform plan -var-file="terraform.tfvars"

# Apply changes
terraform apply -var-file="terraform.tfvars"
```

### Container Deployment

**Phase 2 - ECS Fargate** (Current)
```bash
# Build and push Docker image
docker build -t uplifter .
docker tag uplifter:latest YOUR_ECR_REPO/uplifter:latest
docker push YOUR_ECR_REPO/uplifter:latest

# Update ECS service (via Terraform or AWS CLI)
aws ecs update-service --cluster production-cluster --service production-uplifter --force-new-deployment
```

**Phase 3 - EKS with ArgoCD** (Target)
```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name production-cluster

# ArgoCD syncs automatically from gitops/
# Manual sync if needed:
argocd app sync uplifter-production
```

### GitOps Workflow

1. Push code to `main` branch
2. GitHub Actions builds and pushes Docker image to ECR
3. ArgoCD detects new image and syncs to EKS
4. Groundcover automatically monitors the deployment

### Environment-Specific Configurations

Each environment has:
- Separate RDS database instance
- Separate ElastiCache Redis cluster
- Separate S3 buckets
- Separate API keys (TEST vs LIVE mode for Adyen/Twilio)

---

## External Services Configuration

### Payment Processing (Adyen)

| Environment | Mode | Portal |
|-------------|------|--------|
| Production | LIVE | ca-live.adyen.com |
| Others | TEST | ca-test.adyen.com |

Set `ADYEN_ENVIRONMENT=TEST` for non-production environments.

**Balance Platform model**: The platform uses Adyen's Balance Platform (marketplace model) for onboarding, payouts, and fund management. Each onboarded organization gets:
- A Legal Entity, Account Holder, and Balance Account in Adyen
- A daily sweep that automatically transfers collected funds to the org's bank account
- Webhook-driven payout tracking (status updates, bank account details, estimated arrival times)

**Provisioning**: Use the provisioning script to set up Adyen API credentials, webhooks, and HMAC keys for any environment:

```bash
npx tsx scripts/provision-adyen.ts --env staging --dry-run    # preview
npx tsx scripts/provision-adyen.ts --env staging --output .env.adyen  # create
```

See `docs/adyen-platform/README.md` for the full integration spec and phase breakdown.

### SMS (Twilio)

| Environment | Mode | Notes |
|-------------|------|-------|
| Production | LIVE | Real SMS delivery |
| Others | TEST | Use test phone numbers |
| Local | Mock | Console logging only |

### Email (SES)

| Environment | Mode | Notes |
|-------------|------|-------|
| Production | Production | Any recipient |
| Staging/Dev | Sandbox | Verified recipients only |
| Local | MailHog | View at localhost:8025 |

### Storage (S3)

| Environment | Bucket | CDN |
|-------------|--------|-----|
| Production | uplifter-assets-prod | cdn.uplifterinc.com |
| Staging | uplifter-gymnastics-assets | assets.upliftergymnastics.com |
| Development | uplifter-assets-dev | None |
| Local | MinIO (localhost:9000) | None |

---

## Environment Variables

See `.env.example` for complete documentation. Key variables:

```bash
# Environment identifier
APP_ENVIRONMENT=local

# Database
DATABASE_URL=postgresql://...

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Payments
ADYEN_API_KEY=...
ADYEN_ENVIRONMENT=TEST

# SMS
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Storage
USE_S3_STORAGE=false
AWS_S3_BUCKET=...
S3_ENDPOINT=http://localhost:9000  # For MinIO

# Email
AWS_SES_REGION=us-east-1
SES_ENDPOINT=http://localhost:1025  # For MailHog
```

---

## Long-Term Vision

* High-volume payments
* Reliable infrastructure (EKS with auto-scaling)
* Clean, modern UI
* Strong defaults
* Minimal reinvention
* Multi-environment parity
