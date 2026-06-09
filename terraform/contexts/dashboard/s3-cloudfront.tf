# =============================================================================
# S3 + CloudFront — Dashboard SPA Hosting
# =============================================================================

resource "aws_s3_bucket" "dashboard_spa" {
  bucket        = "${var.project_name}-dashboard-spa-${var.environment}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-dashboard-spa"
  }
}

resource "aws_s3_bucket_website_configuration" "dashboard_spa" {
  bucket = aws_s3_bucket.dashboard_spa.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_policy" "dashboard_spa" {
  bucket = aws_s3_bucket.dashboard_spa.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.dashboard_spa.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.dashboard.arn
          }
        }
      }
    ]
  })
}

# --- CloudFront Origin Access Control ---

resource "aws_cloudfront_origin_access_control" "dashboard" {
  name                              = "${var.project_name}-dashboard-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# --- CloudFront Distribution ---

resource "aws_cloudfront_distribution" "dashboard" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "${var.project_name} Dashboard SPA"

  origin {
    domain_name              = aws_s3_bucket.dashboard_spa.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.dashboard_spa.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.dashboard.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.dashboard_spa.id}"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-dashboard-distribution"
  }
}
