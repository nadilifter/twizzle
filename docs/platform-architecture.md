# Uplifter Platform Architecture

## Overview

Uplifter is a multi-tenant SaaS platform for sports/gymnastics organizations. It uses a subdomain-based access point system where different user roles access different portals.

## Platform Diagram

```mermaid
flowchart TB
    subgraph Internet["Public Internet"]
        User([User])
    end

    subgraph DNS["DNS / Routing Layer"]
        direction LR
        Router{{"*.uplifterinc.com"}}
    end

    User --> Router

    subgraph Portals["Access Point Subdomains"]
        direction TB
        
        subgraph Auth["Authentication & Onboarding"]
            Login["login.uplifterinc.com"]
            Startup["startup.uplifterinc.com"]
        end

        subgraph Admin["Administration"]
            OrgAdmin["admin.uplifterinc.com"]
            SuperAdmin["superadmin.uplifterinc.com"]
        end

        subgraph Operations["Operational Portals"]
            POS["pos.uplifterinc.com"]
            Coach["coach.uplifterinc.com"]
            Events["events.uplifterinc.com"]
            Athletes["athletes.uplifterinc.com"]
        end

        subgraph Public["Public-Facing"]
            Sites["[org-slug].uplifterinc.com"]
            Feedback["feedback.uplifterinc.com"]
        end
    end

    Router --> Login
    Router --> Startup
    Router --> OrgAdmin
    Router --> SuperAdmin
    Router --> POS
    Router --> Coach
    Router --> Events
    Router --> Athletes
    Router --> Sites
    Router --> Feedback

    subgraph Backend["Backend Services"]
        NextJS["Next.js App Router"]
        Auth2["NextAuth.js"]
        API["API Routes"]
    end

    subgraph External["External Services"]
        Adyen["Adyen Payments"]
        Google["Google OAuth"]
        S3["File Storage"]
    end

    subgraph Database["Data Layer"]
        Postgres[(PostgreSQL)]
        Prisma["Prisma ORM"]
    end

    Login --> NextJS
    OrgAdmin --> NextJS
    SuperAdmin --> NextJS
    POS --> NextJS
    Coach --> NextJS
    Sites --> NextJS

    NextJS --> Auth2
    NextJS --> API
    API --> Prisma
    Prisma --> Postgres

    API --> Adyen
    Auth2 --> Google
    API --> S3
```

## Access Points by Role

```mermaid
flowchart LR
    subgraph Roles["User Roles"]
        SA[Super Admin]
        OA[Org Admin]
        ST[Staff/Coach]
        PA[Parent/Athlete]
        PU[Public User]
    end

    subgraph Portals["Accessible Portals"]
        superadmin["superadmin."]
        admin["admin."]
        coach["coach."]
        pos["pos."]
        events["events."]
        athletes["athletes."]
        sites["[slug]."]
        login["login."]
        startup["startup."]
    end

    SA --> superadmin
    SA --> admin
    
    OA --> admin
    OA --> pos
    OA --> coach
    
    ST --> coach
    ST --> pos
    ST --> events
    
    PA --> athletes
    PA --> sites
    
    PU --> sites
    PU --> login
    PU --> startup
```

## Portal Descriptions

| Subdomain | Purpose | Primary Users | Status |
|-----------|---------|---------------|--------|
| `login.` | Authentication, password reset & user signup | All users | Live |
| `startup.` | New organization registration (supports partner referral params) | New customers | Live |
| `admin.` | Organization management dashboard | Org Admins, Staff | Live |
| `superadmin.` | Platform-wide administration | Uplifter staff | Live |
| `pos.` | Point of Sale terminal | Staff at front desk | Live |
| `coach.` | Coach mobile-friendly portal | Coaches | Demo |
| `events.` | Event check-in portal | Staff, Volunteers | Hidden |
| `athletes.` | Parent/Athlete self-service | Parents, Athletes | Live |
| `[org-slug].` | Public marketing site | Public visitors | Live |
| `feedback.` | Feature requests & roadmap | All users | Live |

## Request Flow

```mermaid
sequenceDiagram
    participant User
    participant DNS
    participant Middleware
    participant NextAuth
    participant API
    participant Database

    User->>DNS: admin.uplifterinc.com
    DNS->>Middleware: Route request
    Middleware->>Middleware: Parse subdomain
    Middleware->>NextAuth: Check session
    
    alt Has valid session
        NextAuth->>Middleware: Session valid
        Middleware->>API: Forward to /dashboard
        API->>Database: Fetch org data
        Database->>API: Return data
        API->>User: Render dashboard
    else No session
        NextAuth->>Middleware: No session
        Middleware->>User: Redirect to login.
    end
```

## Multi-Organization Support

```mermaid
flowchart TB
    subgraph User["Single User Account"]
        UserRecord["user@email.com"]
    end

    subgraph Memberships["Organization Memberships"]
        M1["Org A - Admin"]
        M2["Org B - Coach"]
        M3["Org C - Parent"]
    end

    subgraph Sessions["Active Session"]
        ActiveOrg["Currently Active: Org A"]
    end

    UserRecord --> M1
    UserRecord --> M2
    UserRecord --> M3

    M1 --> ActiveOrg

    subgraph Switcher["Organization Switcher"]
        Switch["Switch to Org B or C"]
    end

    ActiveOrg --> Switch
```

Users can belong to multiple organizations with different roles. The session tracks their currently active organization, and they can switch between organizations via the organization switcher in the sidebar.
