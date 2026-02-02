# S3 Module for Uplifter Infrastructure
# Creates S3 buckets for assets and documents

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Assets Bucket (public files like logos, images)
resource "aws_s3_bucket" "assets" {
  bucket = var.assets_bucket_name

  tags = merge(var.tags, {
    Name = var.assets_bucket_name
    Type = "assets"
  })
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = !var.assets_public_access
  block_public_policy     = !var.assets_public_access
  ignore_public_acls      = !var.assets_public_access
  restrict_public_buckets = !var.assets_public_access
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_arn != null ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_key_arn
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  count  = var.assets_lifecycle_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.assets.id

  rule {
    id     = "cleanup"
    status = "Enabled"

    expiration {
      days = var.assets_lifecycle_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Assets bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "assets" {
  count  = var.cloudfront_oai_arn != null ? 1 : 0
  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = var.cloudfront_oai_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.assets.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.assets]
}

# Documents Bucket (private files like waivers, forms)
resource "aws_s3_bucket" "documents" {
  bucket = var.documents_bucket_name

  tags = merge(var.tags, {
    Name = var.documents_bucket_name
    Type = "documents"
  })
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"  # Always version documents for compliance
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_arn != null ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_key_arn
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  count  = var.documents_lifecycle_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "cleanup"
    status = "Enabled"

    expiration {
      days = var.documents_lifecycle_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Intelligent Tiering for documents (move infrequently accessed to cheaper storage)
resource "aws_s3_bucket_intelligent_tiering_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  name   = "AutoTiering"

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
}
