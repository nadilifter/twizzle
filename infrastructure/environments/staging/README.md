# Staging Environment Infrastructure

This directory contains Terraform configuration for staging infrastructure. Note that the current staging environment was provisioned manually by DevOps.

## Current Setup (Provisioned by DevOps)

The staging environment uses:
- **S3 Buckets**: 
  - `uplifter-gymnastics-assets` - public assets via CloudFront
  - `uplifter-gymnastics-docs` - private documents
- **CloudFront CDN**: `assets.upliftergymnastics.com` (serves assets bucket)
- **SES**: Verified for `upliftergymnastics.com`
- **EC2 Instance**: Has IAM role-based access to S3 buckets (no access keys needed)

## Application Configuration

The application is configured to use these resources via `src/lib/env-domains.ts`:

```typescript
staging: {
  s3Bucket: 'uplifter-gymnastics-assets',
  s3DocumentsBucket: 'uplifter-gymnastics-docs',
  cdnUrl: 'https://assets.upliftergymnastics.com',
  // ...
}
```

## EC2 Environment Variables

The EC2 instance needs these environment variables in `~/.env.uplifter`:

```bash
# Required
APP_ENVIRONMENT=staging
USE_S3_STORAGE=true
AWS_S3_REGION=us-east-1

# No AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY needed
# The EC2 instance uses IAM role-based access
```

## How It Works

1. **File Uploads**: User uploads a file via the dashboard
2. **API Route**: `/api/upload` receives the file
3. **S3 Storage**: File is stored in `uplifter-gymnastics-assets` bucket
4. **CDN URL**: The public URL uses CloudFront: `https://assets.upliftergymnastics.com/{key}`
5. **Database**: The CDN URL is stored in the database

## Terraform Files (Reference Only)

The Terraform files in this directory were created for an alternative approach using IAM access keys. They can be used as a reference or adapted for production:

- `main.tf` - S3 module invocation and IAM user creation
- `variables.tf` - Variable definitions
- `outputs.tf` - Output values

## Verification

To verify S3 is working:

1. Log into staging as an organization admin
2. Go to Dashboard → Organization → Website
3. Upload a logo image
4. Check that the image displays correctly
5. Verify the URL starts with `https://assets.upliftergymnastics.com/`

## Database Migrations

Database schema changes must be applied via Prisma Migrate before the application starts. On each deployment:

```bash
# Run pending migrations against the staging database
pnpm prisma migrate deploy
```

This is separate from `prisma db push` (which the dev container previously used). `migrate deploy` applies only committed migration files and is safe for shared environments. It should be run as a pre-start step in the deployment script or container entrypoint.

### Verifying Migration Status

To check whether schema and migrations are in sync before deploying:

```bash
pnpm db:check
```

If this exits non-zero, there are schema changes without a matching migration — do **not** deploy until that is resolved.

---

## Troubleshooting

### Upload fails with "Access Denied"
- Verify the EC2 instance has the correct IAM role attached
- Check that `USE_S3_STORAGE=true` is set
- Check that `APP_ENVIRONMENT=staging` is set

### Images don't display
- Verify CloudFront distribution is active
- Check that the CDN URL is correct in `env-domains.ts`
- Check browser console for CORS errors

### Wrong bucket being used
- Ensure `APP_ENVIRONMENT=staging` is set (not `production` or `local`)
- Restart the application after changing environment variables
