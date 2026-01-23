# Uplifter

## Overview

This repository is the the code for vertical SaaS businesses focused on US gymnastics gyms. It is intentionally opinionated, modern by default, and designed to scale from early-stage experimentation to serious production workloads.

This is **not** a public starter template and is **not** intended for general reuse. It exists so we can move quickly today while establishing a durable baseline for the large project we are building.

---

## What This Repo Is

* A long-lived **monorepo foundation** for our vertical SaaS business focused on US gymnastics
* Designed based on normal B2B software practices
* Built to handle high transaction volume, burst traffic, and evolving product needs

## What This Repo Is Not

* Not an open-source starter
* Not optimized for one-off experiments
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
* **Monorepo**: Turborepo
* **Frontend Framework**: Next.js (App Router)
* **UI System**: Shadcn UI
* **Payments**: Stripe & Adyen
* **Linting & Formatting**: ESLint, Prettier
* **Containers**: Docker
* **Environment**:

  * Linux / WSL-first development
  * Fully virtualized hosting

---

## Repository Structure

### Applications

* `apps/web`

  * Public-facing customer application (registrants/customers)
  * Authenticated product experience

* `apps/admin`

  * Internal administrative dashboard for business owners and staff
  * Operational tooling and configuration

* `apps/docs`

  * Internal and external documentation
  * Engineering, product, and operational references

### Shared Packages

* `packages/ui`

  * Shared React component library
  * Built on Shadcn
  * Themeable and extensible for white-label use

* `packages/eslint-config`

  * Shared ESLint configuration

* `packages/typescript-config`

  * Shared TypeScript configuration

---

## Multi-Tenant and White-Label Assumptions

This base does not implement full multi-tenancy out of the box, but it **must not prevent** the following:

* White-labeled applications
* Customer-facing marketing websites
* Custom domains and subdomains per customer
* Hosting many independent sites on shared infrastructure
* Strong isolation between tenants
* Large registration or checkout surges

---

## Development

### Prerequisites

* Node.js (LTS)
* pnpm (Use `corepack enable` or `npm i -g pnpm`)
* Docker
* Linux or WSL environment

### Common Commands

```bash
# Install dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Build all apps and packages
pnpm build
```

Turborepo task filtering should be used sparingly and intentionally. Default workflows should remain simple.

---

## Deployment Assumptions

* All services are containerized
* Designed for modern cloud platforms
* Secure, stable website hosting is a baseline requirement
* CI/CD pipelines are expected to leverage caching and parallelism

---

## Long-Term Vision

* High-volume payments
* Reliable infrastructure
* Clean, modern UI
* Strong defaults
* Minimal reinvention