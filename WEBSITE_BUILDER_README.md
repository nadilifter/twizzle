# Website Builder & Subdomains

This project supports multi-tenancy via subdomains (e.g., `gym-name.uplifterinc.com` or `gym-name.localhost:3000`).

## Local Development Setup

To test subdomains locally, you need to alias the domains to `127.0.0.1` in your hosts file.

### 1. Edit Hosts File

**Linux/Mac:** `/etc/hosts`
**Windows:** `C:\Windows\System32\drivers\etc\hosts`

Add the following lines:
```
127.0.0.1   test.localhost
127.0.0.1   gym.localhost
```

### 2. Configure a Website

1. Log in to the dashboard at `http://localhost:3000`.
2. Go to **Organization > Website**.
3. Set the **Subdomain** field (e.g., `test` or `gym`).
4. Publish the website.

### 3. Access the Site

Visit `http://test.localhost:3000` or `http://gym.localhost:3000`.

## Architecture

- **Middleware**: `src/middleware.ts` rewrites requests from subdomains to `/sites/[subdomain]`.
- **Admin UI**: `src/app/dashboard/organization/website/page.tsx`
- **Public Site**: `src/app/sites/[slug]/page.tsx`
