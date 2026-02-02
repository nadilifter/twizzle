# S3 Module Outputs

output "assets_bucket_name" {
  description = "Name of the assets bucket"
  value       = aws_s3_bucket.assets.bucket
}

output "assets_bucket_arn" {
  description = "ARN of the assets bucket"
  value       = aws_s3_bucket.assets.arn
}

output "assets_bucket_domain_name" {
  description = "Domain name of the assets bucket"
  value       = aws_s3_bucket.assets.bucket_domain_name
}

output "assets_bucket_regional_domain_name" {
  description = "Regional domain name of the assets bucket"
  value       = aws_s3_bucket.assets.bucket_regional_domain_name
}

output "documents_bucket_name" {
  description = "Name of the documents bucket"
  value       = aws_s3_bucket.documents.bucket
}

output "documents_bucket_arn" {
  description = "ARN of the documents bucket"
  value       = aws_s3_bucket.documents.arn
}

output "documents_bucket_domain_name" {
  description = "Domain name of the documents bucket"
  value       = aws_s3_bucket.documents.bucket_domain_name
}
