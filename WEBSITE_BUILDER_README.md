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
2. Go to **Website > General**.
3. Set the **Subdomain** field (e.g., `test` or `gym`).
4. Publish the website.

### 3. Access the Site

Visit `http://test.localhost:3000` or `http://gym.localhost:3000`.

## Architecture

- **Middleware**: `src/middleware.ts` internally rewrites subdomain requests to `/sites/[subdomain]` (see URL rules below).
- **Admin UI**: `src/app/dashboard/website/page.tsx`
- **Public Site**: `src/app/sites/[slug]/page.tsx`

## Tenant Site URL Construction Rules

The middleware rewrites tenant subdomain requests **internally** — the `/sites/[slug]` prefix must never appear in browser-visible URLs. Getting this wrong causes 404 errors from double-prefixing.

**How it works:** When a user visits `gym-name.uplifterinc.com/checkout`, the middleware rewrites the request internally to `/sites/gym-name/checkout`. The browser URL stays as `/checkout`. If client-side code navigates to `/sites/gym-name/checkout` directly, the middleware rewrites it again to `/sites/gym-name/sites/gym-name/checkout` — a path that doesn't exist.

### Client-side navigation (Link, router.push)

Always use simple paths without the `/sites/[slug]` prefix:

```tsx
// CORRECT
<Link href="/checkout">Checkout</Link>
<Link href="/register">Register</Link>
router.push("/queue")

// WRONG — will cause 404 from double-prefixing
<Link href={`/sites/${slug}/checkout`}>Checkout</Link>
router.push(`/sites/${slug}/queue`)
```

### API fetch calls from tenant site components

API routes starting with `/api` are **not** rewritten by middleware, so they need the explicit `/api/sites/${slug}/...` path:

```tsx
// CORRECT — API routes need the full path
fetch(`/api/sites/${params.slug}/checkout/session`, { method: "POST", ... })
fetch(`/api/sites/${slug}/family/contacts`)

// CORRECT — public API routes without /sites/ prefix also work
fetch("/api/public/waivers/check", { method: "POST", ... })
```

### Server components and page params

Server components receive `params.slug` from the rewritten route. Use it for database lookups and API calls, but never for constructing client-visible navigation URLs:

```tsx
// CORRECT — use params.slug for data fetching
export default async function Page({ params }: { params: { slug: string } }) {
  const config = await db.websiteConfig.findUnique({ where: { subdomain: params.slug } });
}
```
