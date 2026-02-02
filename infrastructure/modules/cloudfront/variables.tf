# CloudFront Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
}

variable "domain_aliases" {
  description = "List of domain aliases for the distribution"
  type        = list(string)
  default     = []
}

variable "s3_bucket_name" {
  description = "S3 bucket name for assets"
  type        = string
}

variable "s3_bucket_regional_domain_name" {
  description = "S3 bucket regional domain name"
  type        = string
}

variable "alb_dns_name" {
  description = "ALB DNS name for dynamic content"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1)"
  type        = string
}

variable "cloudfront_secret" {
  description = "Secret header value for ALB origin verification"
  type        = string
  sensitive   = true
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
}

variable "web_acl_id" {
  description = "WAF Web ACL ID"
  type        = string
  default     = null
}

variable "geo_restriction_type" {
  description = "Geo restriction type (none, whitelist, blacklist)"
  type        = string
  default     = "none"
}

variable "geo_restriction_locations" {
  description = "List of country codes for geo restriction"
  type        = list(string)
  default     = []
}

variable "create_dns_record" {
  description = "Create Route 53 DNS record for CDN"
  type        = bool
  default     = true
}

variable "route53_zone_id" {
  description = "Route 53 zone ID"
  type        = string
  default     = null
}

variable "cdn_subdomain" {
  description = "Subdomain for CDN (e.g., 'cdn')"
  type        = string
  default     = "cdn"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
