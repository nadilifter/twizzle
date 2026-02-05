# Staging Environment Infrastructure

This directory contains Terraform configuration for the staging environment AWS services.

## Overview

The staging environment uses:
- **S3 Buckets**: `uplifter-assets-staging` (public) and `uplifter-documents-staging` (private)
- **SES Email**: Domain-verified email sending via AWS SES
- **IAM User**: `uplifter-staging-services` with S3 and SES permissions
- **EC2 Instance**: Existing EC2 running Docker Compose (configured separately)

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.5.0 installed
3. Access to create S3 buckets and IAM users in AWS

## Quick Start

### Option A: Using Terraform (Recommended)

```bash
cd infrastructure/environments/staging

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply changes
terraform apply

# Get the AWS credentials for EC2
terraform output staging_access_key_id
terraform output -raw staging_secret_access_key

# View required DNS records for SES
terraform output dns_records_required

# Or get the complete env file content
terraform output env_file_content
```

**After running Terraform, you MUST add DNS records for SES verification.** See [SES Email Setup](#ses-email-setup) below.

### Option B: Manual AWS Console Setup

If you prefer to create resources manually:

1. **Create Assets Bucket** (`uplifter-assets-staging`):
   - Region: us-east-1
   - ACLs: Enabled
   - Block Public Access: OFF (uncheck all)
   - Versioning: Enabled
   - Add bucket policy for public read:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [{
         "Sid": "PublicReadAccess",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::uplifter-assets-staging/*"
       }]
     }
     ```
   - Add CORS configuration:
     ```json
     [
       {
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET", "HEAD"],
         "AllowedOrigins": ["https://upliftergymnastics.com", "https://*.upliftergymnastics.com"],
         "ExposeHeaders": ["ETag"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```

2. **Create Documents Bucket** (`uplifter-documents-staging`):
   - Region: us-east-1
   - ACLs: Disabled
   - Block Public Access: ON (check all)
   - Versioning: Enabled
   - Encryption: SSE-S3 (AES256)

3. **Create IAM User** (`uplifter-staging-services`):
   - Enable programmatic access
   - Attach inline policy (S3 + SES):
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "ListBuckets",
           "Effect": "Allow",
           "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
           "Resource": [
             "arn:aws:s3:::uplifter-assets-staging",
             "arn:aws:s3:::uplifter-documents-staging"
           ]
         },
         {
           "Sid": "AssetsBucketAccess",
           "Effect": "Allow",
           "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:PutObjectAcl"],
           "Resource": "arn:aws:s3:::uplifter-assets-staging/*"
         },
         {
           "Sid": "DocumentsBucketAccess",
           "Effect": "Allow",
           "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
           "Resource": "arn:aws:s3:::uplifter-documents-staging/*"
         },
         {
           "Sid": "SESSendEmail",
           "Effect": "Allow",
           "Action": ["ses:SendEmail", "ses:SendRawEmail"],
           "Resource": "*",
           "Condition": {
             "StringEquals": {
               "ses:FromAddress": "noreply@upliftergymnastics.com"
             }
           }
         }
       ]
     }
     ```
   - Save the Access Key ID and Secret Access Key

## SES Email Setup

AWS SES requires domain verification before you can send emails. Terraform creates the SES identity resources, but you must add DNS records manually.

### Step 1: Get DNS Records from Terraform

After running `terraform apply`, get the required DNS records:

```bash
terraform output dns_records_required
```

This will display:
- 1 TXT record for domain verification
- 3 CNAME records for DKIM email authentication

### Step 2: Add DNS Records

Add these records in your DNS provider (e.g., Route53, Cloudflare, Namecheap):

| Type  | Name                                          | Value                           |
|-------|-----------------------------------------------|---------------------------------|
| TXT   | `_amazonses.upliftergymnastics.com`           | *(from terraform output)*       |
| CNAME | `<token1>._domainkey.upliftergymnastics.com`  | `<token1>.dkim.amazonses.com`   |
| CNAME | `<token2>._domainkey.upliftergymnastics.com`  | `<token2>.dkim.amazonses.com`   |
| CNAME | `<token3>._domainkey.upliftergymnastics.com`  | `<token3>.dkim.amazonses.com`   |

### Step 3: Verify Domain Status

DNS propagation typically takes 5-15 minutes. Check status in:
1. **AWS Console**: SES → Verified identities → upliftergymnastics.com
2. **CLI**: `aws ses get-identity-verification-attributes --identities upliftergymnastics.com`

The domain should show "Verified" status.

### Step 4: Sandbox Mode (Important!)

New SES accounts start in **sandbox mode** with these limitations:
- Can only send to **verified email addresses**
- Limited to 200 emails per 24 hours
- Limited to 1 email per second

**For the pilot, you have two options:**

#### Option A: Stay in Sandbox (Quick Start)
Verify each pilot participant's email address:
1. Go to AWS SES Console → Verified identities
2. Click "Create identity" → "Email address"
3. Enter the pilot participant's email
4. They'll receive a verification email to click

#### Option B: Request Production Access (Recommended for Full Launch)
1. Go to AWS SES Console → Account dashboard
2. Click "Request production access"
3. Fill out the form:
   - **Mail Type**: Transactional
   - **Website URL**: https://upliftergymnastics.com
   - **Use Case**: Describe your application (password resets, notifications, etc.)
   - **Expected Volume**: Estimate daily/monthly volume
   - **Bounce Handling**: Explain you handle bounces via webhooks
4. Wait 24-48 hours for AWS approval

### SES Troubleshooting

#### "Email address not verified" error
- In sandbox mode, recipient emails must be verified
- Verify recipient in SES Console or request production access

#### "Sender email address not verified" error
- The from address `noreply@upliftergymnastics.com` must be verified
- Terraform creates an email identity for this; check SES Console

#### Domain shows "Pending verification"
- DNS records may not have propagated yet
- Wait 15-30 minutes and check again
- Verify DNS records are correct using `dig` or online DNS checker

## Configuring the EC2 Staging Instance

After creating the AWS resources and verifying DNS, configure the EC2 instance:

1. **SSH to the staging EC2 instance**:
   ```bash
   ssh ubuntu@staging.upliftergymnastics.com
   ```

2. **Update the environment file**:
   ```bash
   nano ~/.env.uplifter
   ```

3. **Add/update AWS configuration** (S3 + SES):
   ```bash
   # AWS Credentials (used for S3 and SES)
   AWS_ACCESS_KEY_ID=<your-access-key-id>
   AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
   
   # S3 Storage Configuration
   USE_S3_STORAGE=true
   AWS_S3_REGION=us-east-1
   
   # SES Email Configuration
   AWS_SES_REGION=us-east-1
   AWS_SES_FROM_EMAIL=noreply@upliftergymnastics.com
   ```

   Or use the Terraform output directly:
   ```bash
   # On your local machine, get the env content
   terraform output env_file_content
   
   # Copy and paste into ~/.env.uplifter on EC2
   ```

4. **Restart the application**:
   ```bash
   cd ~/uplifter
   docker-compose -f docker-compose.staging.yml down
   docker-compose -f docker-compose.staging.yml up -d
   ```

5. **Verify the application is running**:
   ```bash
   docker-compose -f docker-compose.staging.yml logs -f app
   ```

## Verification

### Verify S3 is Working

1. Log into the staging app as an organization admin
2. Go to Dashboard → Organization → Website
3. Upload a logo image
4. Check the S3 console to confirm the file was uploaded
5. Verify the logo displays correctly on the public website

### Verify SES is Working

1. **Check domain verification status**:
   - Go to AWS SES Console → Verified identities
   - Domain should show "Verified" status
   - DKIM should show "Successful"

2. **Test password reset email**:
   - If in sandbox mode, first verify your test email address in SES Console
   - Go to the login page and click "Forgot password"
   - Enter a verified email address
   - Check inbox for password reset email

3. **Check application logs**:
   ```bash
   docker-compose -f docker-compose.staging.yml logs app | grep -i email
   ```
   
   Look for:
   - `[EMAIL] Email sent successfully via SES` = Working
   - `[EMAIL] Failed to send email via SES` = Check error message

## Outputs

After running Terraform, these outputs are available:

| Output | Description |
|--------|-------------|
| `assets_bucket_name` | Name of the public assets bucket |
| `assets_bucket_url` | Public URL for accessing assets |
| `documents_bucket_name` | Name of the private documents bucket |
| `ses_domain` | The verified SES domain |
| `ses_verification_token` | TXT record value for domain verification |
| `ses_dkim_tokens` | DKIM CNAME record tokens |
| `ses_from_email` | The verified from email address |
| `staging_access_key_id` | IAM access key ID (for S3 + SES) |
| `staging_secret_access_key` | IAM secret access key (sensitive) |
| `env_file_content` | Ready-to-use environment variables (sensitive) |
| `dns_records_required` | Formatted DNS records to add |

## Security Notes

- The documents bucket blocks all public access
- The assets bucket allows public read access (required for logos, images)
- IAM credentials have minimal permissions (S3 + SES only)
- SES permissions are restricted to the verified from address
- Never commit access keys to version control
- Rotate credentials periodically

## Troubleshooting

### S3 Issues

#### Upload fails with "Access Denied"
- Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set correctly
- Check IAM policy has correct bucket ARNs
- Ensure USE_S3_STORAGE=true is set

#### Images don't display
- Check the bucket's public access settings
- Verify CORS is configured correctly
- Check browser console for CORS errors

### SES Issues

#### Emails not being sent
- Check `AWS_SES_REGION` and `AWS_SES_FROM_EMAIL` are set
- Verify domain is verified in SES Console
- Check application logs for error messages

#### "MessageRejected: Email address is not verified"
- You're in sandbox mode and the recipient isn't verified
- Either verify the recipient email in SES Console
- Or request production access

#### "AccessDenied" when sending email
- Verify the IAM user has SES permissions
- Check the from address matches the policy condition
- Ensure the domain identity is verified

#### Emails going to spam
- Wait for DKIM verification to complete
- Check all 3 DKIM CNAME records are configured
- Consider adding SPF record: `v=spf1 include:amazonses.com ~all`

### Terraform Issues

#### Terraform apply fails
- Ensure bucket names are globally unique (add suffix if needed)
- Verify AWS credentials have permission to create S3/IAM/SES resources

#### "DomainAlreadyExists" error
- The domain is already registered in SES in this region
- Import the existing resource or use a different region
