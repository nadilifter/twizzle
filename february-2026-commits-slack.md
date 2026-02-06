*February 2026 – Commits to main (origin)*

*1. Programs, calendar & scheduling*

• *Calendar & instances (Feb 5–6)*
Programs now use RecurrenceType (RECURRING/NON_RECURRING) and RegistrationType (ALL_SESSIONS/PER_INSTANCE). New ProgramInstance model (date, time, facility, capacity, status) plus InstanceRegistration and InstanceAttendance. RecurrencePicker component with rrule. Dashboard calendar at /dashboard/calendar with month/week/day views and mobile layouts. Program instance detail page for registrations, attendance, evaluations per session. Marketing site uses shared ProgramCalendar; public calendar API; admin vs non-admin routing. Time display: 12h AM/PM, event pills, day view date-range fix. Calendar page removed from admin sidebar; breadcrumbs hidden on mobile.

• *Program creation, pricing & display (Feb 5–6)*
Price input (per-session or flat) in creation stepper; Date & Location step; Availability renamed to Requirements. Config tray rewritten (General, Schedule, Requirements, Staff). Edit → "View Session(s)" and sessions list. Age/level restrictions and new program management stepper. ProgramCard and lists show level, capacity, age, membership; add-to-cart disabled when full. Program detail: two-column layout, ProgramCard sidebar. Unpriced programs show as free ($0). Legacy cleanup: removed old program fields and entire MembershipTier model.

• *Program levels & bulk discounts (Feb 4)*
ProgramLevel and BulkDiscount models, CRUD APIs, training levels dashboard, membership requirement dialog, seed updates.

*2. Authentication & login (cross-subdomain)*

• Staging redirect loop and OAuth callback errors fixed via centralized auth cookie config (auth-cookies.ts) for pkceCodeVerifier, state, nonce with cross-subdomain sharing.
• Credentials login: removed custom /api/auth/providers that broke signIn; check result.ok; local subdomain POST to current origin so session cookie set correctly (SessionMissing fix).
• Cookies refactored to __Secure- prefix + domain for cross-subdomain; CORS and middleware fixes for /api/auth.
• Custom /api/auth/logout clears cookies with correct domain so logout works across subdomains.
• Root-domain auth routes redirect to login subdomain; credentials-bridge and session-bridge; Google OAuth CORS and local dev docs.
• Misc: middleware currentEnv/duplicate variable fixes, auth import, trustHost/Nginx, login portal 500 fix (getLoginHost/getSubdomainHost moved before use).

*3. User management, invitations & password reset (Feb 3)*

• OrganizationInvitation model and /api/invitations; /accept-invitation and invitation emails.
• PasswordResetToken; /api/auth/forgot-password and reset-password; improved forms and token validation.
• /sites/[slug]/signup for org-specific athlete/parent registration.
• Credentials-bridge for local subdomain session; invitation-only staff signup. Migrations: add_organization_invitation, add_password_reset_tokens.

*4. Payments & billing (Feb 5)*

• Adyen: payment methods API and UI, recurring webhook, org signup flow with Drop-in, cart removal dialog, phone input, migration.
• Subscription caps: maxPrograms, maxStorageMB, maxMembershipTypes on SubscriptionPlan; fileSize on Media; superadmin plan reorder; APIs enforce limits; billing page "X / Y" usage; plan selector warnings.

*5. Storage & assets (Feb 5)*

• S3 staging: buckets uplifter-gymnastics-assets/docs, CloudFront assets.upliftergymnastics.com, EC2 IAM.
• Next.js images.remotePatterns for S3/CDN; staging CDN fix; s3Bucket in env; fixes logo/hero and admin previews.

*6. Superadmin*

• Users: search, filters (role, org, status), role badges, Last Login/Created, detail page at /superadmin/users/[id].
• Orgs: routes [id]→[slug], trials management page/API; signup callback and domain config for Docker/proxy; staff account auto-creation.
• Reserved domains: DB-driven EXACT/PREFIX; shared isSubdomainReserved; portal and infra/account/brand reserved; test/demo reserved.
• Signup: org signup subdomain signup.*→startup.*; canonical /org-signup and /api/org-signup; superadmin domains and quick links fixed.
• Feedback: DB-backed API, superadmin management, voting/comments/status, email on change. Announcements and notification bell; view-as-coach. Revenue dashboard.

*7. Marketing site & UX (Feb 2, 5–6)*

• Configurable info boxes (up to 3, title + WYSIWYG) in WebsiteConfig; dark logos and UplifterLogo; theme-aware layouts and contact page; cookie banner essential-only + privacy/terms links; container sizing and full dark mode on marketing pages.

*8. Notifications, evaluations & achievements (Feb 2)*

• Notifications with read/unread and mark-all-read. Athlete achievements API and UI. Evaluation template sync and program-level templates; migrations and seed.

*9. Infrastructure & deployment (Feb 2, 4–5)*

• Registration queue: reservation timers, queue gates, auto-expiry; middleware. Kubernetes: Helm, ArgoCD, Terraform (EKS, RDS, ElastiCache, S3, CloudFront, VPC, ALB). Staging deploy: Docker cleanup and stopped-container cleanup. Docker/Prisma: correct network, Prisma v6 pin, schema in image. .env removed from repo; new lib modules (email, storage, webhooks, env-domains, services-config); Cursor rules updated.

*10. Seed (Feb 5)*

• Discover Circus: full seed – Nelson BC org, users, facility, 6 levels, 36 programs (aerial silks, hoop, trapeze, etc.), website config, logo/favicon.
