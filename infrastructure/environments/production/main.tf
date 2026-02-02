# Production Environment Configuration
# This is the main Terraform configuration for the production environment

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
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "production"
      Project     = "uplifter"
      ManagedBy   = "terraform"
    }
  }
}

# Provider for us-east-1 (required for CloudFront ACM certificates)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

locals {
  environment = "production"
  domain      = "uplifterinc.com"

  common_tags = {
    Environment = local.environment
    Project     = "uplifter"
  }
}

# VPC
module "vpc" {
  source = "../../modules/vpc"

  environment        = local.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  enable_nat_gateway = true
  single_nat_gateway = false  # HA: NAT per AZ
  enable_flow_logs   = true

  tags = local.common_tags
}

# RDS PostgreSQL
module "rds" {
  source = "../../modules/rds"

  environment             = local.environment
  vpc_id                  = module.vpc.vpc_id
  subnet_ids              = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs.security_group_id]

  instance_class            = "db.r6g.large"
  allocated_storage         = 100
  max_allocated_storage     = 500
  multi_az                  = true
  backup_retention_period   = 30
  deletion_protection       = true
  skip_final_snapshot       = false
  create_read_replica       = true
  performance_insights_enabled = true
  enhanced_monitoring_interval = 60

  database_name   = "uplifter"
  master_username = var.db_username
  master_password = var.db_password

  tags = local.common_tags
}

# ElastiCache Redis
module "elasticache" {
  source = "../../modules/elasticache"

  environment             = local.environment
  vpc_id                  = module.vpc.vpc_id
  subnet_ids              = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs.security_group_id]

  node_type          = "cache.r6g.large"
  num_cache_clusters = 2  # Primary + replica for HA
  snapshot_retention_limit = 7
  create_cloudwatch_alarms = true

  tags = local.common_tags
}

# S3 Buckets
module "s3" {
  source = "../../modules/s3"

  assets_bucket_name    = "uplifter-assets-prod"
  documents_bucket_name = "uplifter-documents-prod"
  assets_public_access  = false  # Access via CloudFront only
  enable_versioning     = true

  cors_allowed_origins = [
    "https://uplifterinc.com",
    "https://*.uplifterinc.com"
  ]

  cloudfront_oai_arn = module.cloudfront.origin_access_identity_arn

  tags = local.common_tags
}

# ALB
module "alb" {
  source = "../../modules/alb"

  environment         = local.environment
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  certificate_arn     = var.acm_certificate_arn
  health_check_path   = "/api/health"

  tags = local.common_tags
}

# ECS Fargate
module "ecs" {
  source = "../../modules/ecs"

  environment           = local.environment
  aws_region            = var.aws_region
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  alb_security_group_id = module.alb.security_group_id
  target_group_arn      = module.alb.target_group_arn

  container_image = var.container_image
  container_port  = 3000
  task_cpu        = 1024
  task_memory     = 2048
  desired_count   = 2

  enable_autoscaling = true
  min_capacity       = 2
  max_capacity       = 20
  cpu_target_value   = 70

  enable_fargate_spot = true
  fargate_base_count  = 2  # Always have 2 on-demand for baseline

  s3_bucket_arns = [
    module.s3.assets_bucket_arn,
    "${module.s3.assets_bucket_arn}/*",
    module.s3.documents_bucket_arn,
    "${module.s3.documents_bucket_arn}/*"
  ]

  environment_variables = [
    { name = "NODE_ENV", value = "production" },
    { name = "APP_ENVIRONMENT", value = "production" },
    { name = "NEXTAUTH_URL", value = "https://login.uplifterinc.com" },
    { name = "AWS_S3_BUCKET", value = module.s3.assets_bucket_name },
    { name = "AWS_S3_REGION", value = var.aws_region },
  ]

  secrets = [
    { name = "DATABASE_URL", valueFrom = "${var.secrets_arn}:DATABASE_URL::" },
    { name = "NEXTAUTH_SECRET", valueFrom = "${var.secrets_arn}:NEXTAUTH_SECRET::" },
    { name = "GOOGLE_CLIENT_ID", valueFrom = "${var.secrets_arn}:GOOGLE_CLIENT_ID::" },
    { name = "GOOGLE_CLIENT_SECRET", valueFrom = "${var.secrets_arn}:GOOGLE_CLIENT_SECRET::" },
    { name = "ADYEN_API_KEY", valueFrom = "${var.secrets_arn}:ADYEN_API_KEY::" },
    { name = "TWILIO_AUTH_TOKEN", valueFrom = "${var.secrets_arn}:TWILIO_AUTH_TOKEN::" },
  ]

  tags = local.common_tags
}

# CloudFront CDN
module "cloudfront" {
  source = "../../modules/cloudfront"

  environment                    = local.environment
  domain_name                    = local.domain
  domain_aliases                 = ["cdn.${local.domain}"]
  s3_bucket_name                 = module.s3.assets_bucket_name
  s3_bucket_regional_domain_name = module.s3.assets_bucket_regional_domain_name
  alb_dns_name                   = module.alb.dns_name
  acm_certificate_arn            = var.cloudfront_certificate_arn
  cloudfront_secret              = var.cloudfront_secret
  price_class                    = "PriceClass_100"
  route53_zone_id                = var.route53_zone_id
  cdn_subdomain                  = "cdn"

  tags = local.common_tags
}
