# CloudFront Module Outputs

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.main.arn
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}

output "origin_access_identity_arn" {
  description = "Origin Access Identity ARN for S3 bucket policy"
  value       = aws_cloudfront_origin_access_identity.main.iam_arn
}

output "origin_access_identity_path" {
  description = "Origin Access Identity path"
  value       = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
}
