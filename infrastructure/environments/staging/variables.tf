# Staging Environment Variables

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "assets_bucket_name" {
  description = "Name of the S3 bucket for public assets"
  type        = string
  default     = "uplifter-gymnastics-assets"
}

variable "documents_bucket_name" {
  description = "Name of the S3 bucket for private documents"
  type        = string
  default     = "uplifter-gymnastics-docs"
}
