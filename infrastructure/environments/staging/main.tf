# Staging Environment Configuration
# Simplified setup for EC2-based staging deployment with S3 storage

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket         = "uplifter-terraform-state"
  #   key            = "staging/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "staging"
      Project     = "uplifter"
      ManagedBy   = "terraform"
    }
  }
}

locals {
  environment = "staging"
  domain      = "upliftergymnastics.com"

  common_tags = {
    Environment = local.environment
    Project     = "uplifter"
  }
}

# =============================================================================
# S3 Buckets
# =============================================================================

module "s3" {
  source = "../../modules/s3"

  assets_bucket_name    = var.assets_bucket_name
  documents_bucket_name = var.documents_bucket_name
  
  # Enable public access for assets (no CloudFront in staging initially)
  assets_public_access = true
  enable_versioning    = true

  cors_allowed_origins = [
    "https://${local.domain}",
    "https://*.${local.domain}"
  ]

  # Lifecycle policies for cost optimization in staging
  assets_lifecycle_days    = 0   # Don't expire assets (they're referenced in DB)
  documents_lifecycle_days = 0   # Don't expire documents (they're referenced in DB)

  # No CloudFront in staging initially - using direct S3 access
  cloudfront_oai_arn = null

  tags = local.common_tags
}

# =============================================================================
# AWS SES Email Service
# =============================================================================

# SES Domain Identity - verifies ownership of the domain for sending emails
resource "aws_ses_domain_identity" "staging" {
  domain = local.domain
}

# SES DKIM - enables DomainKeys Identified Mail for email authentication
# This creates 3 CNAME records that must be added to DNS
resource "aws_ses_domain_dkim" "staging" {
  domain = aws_ses_domain_identity.staging.domain
}

# SES Email Identity - verify the specific from address
# This is optional but recommended for sandbox mode testing
resource "aws_ses_email_identity" "noreply" {
  email = "noreply@${local.domain}"
}

# =============================================================================
# IAM User for EC2 Staging Instance
# =============================================================================

resource "aws_iam_user" "staging_services" {
  name = "uplifter-staging-services"
  path = "/service-accounts/"

  tags = local.common_tags
}

resource "aws_iam_access_key" "staging_services" {
  user = aws_iam_user.staging_services.name
}

# IAM Policy for S3 and SES access
resource "aws_iam_user_policy" "staging_services" {
  name = "uplifter-staging-services-access"
  user = aws_iam_user.staging_services.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3 Permissions
      {
        Sid    = "ListBuckets"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          module.s3.assets_bucket_arn,
          module.s3.documents_bucket_arn
        ]
      },
      {
        Sid    = "AssetsBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:PutObjectAcl"  # Required for public-read ACL on assets
        ]
        Resource = "${module.s3.assets_bucket_arn}/*"
      },
      {
        Sid    = "DocumentsBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
          # No PutObjectAcl - documents should never be public
        ]
        Resource = "${module.s3.documents_bucket_arn}/*"
      },
      # SES Permissions
      {
        Sid    = "SESSendEmail"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = "noreply@${local.domain}"
          }
        }
      }
    ]
  })
}

# =============================================================================
# S3 Bucket Policy for Public Assets Access
# =============================================================================

# Allow public read access to assets bucket (since we're not using CloudFront)
resource "aws_s3_bucket_policy" "assets_public" {
  bucket = module.s3.assets_bucket_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadAccess"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${module.s3.assets_bucket_arn}/*"
      }
    ]
  })

  # Ensure public access block is configured first
  depends_on = [module.s3]
}
