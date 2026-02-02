# S3 Module Variables

variable "assets_bucket_name" {
  description = "Name of the S3 bucket for assets"
  type        = string
}

variable "documents_bucket_name" {
  description = "Name of the S3 bucket for documents"
  type        = string
}

variable "assets_public_access" {
  description = "Allow public access to assets bucket"
  type        = bool
  default     = false
}

variable "enable_versioning" {
  description = "Enable versioning on the assets bucket"
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS"
  type        = list(string)
}

variable "assets_lifecycle_days" {
  description = "Number of days before assets expire (0 to disable)"
  type        = number
  default     = 0
}

variable "documents_lifecycle_days" {
  description = "Number of days before documents expire (0 to disable)"
  type        = number
  default     = 0
}

variable "cloudfront_oai_arn" {
  description = "CloudFront Origin Access Identity ARN for bucket policy"
  type        = string
  default     = null
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
