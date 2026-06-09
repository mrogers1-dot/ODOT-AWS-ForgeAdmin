# =============================================================================
# S3 — Archival Storage with Lifecycle Policies
# =============================================================================

resource "aws_s3_bucket" "platform_storage" {
  bucket        = "${var.project_name}-platform-storage-${var.environment}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-platform-storage"
  }
}

resource "aws_s3_bucket_versioning" "platform_storage" {
  bucket = aws_s3_bucket.platform_storage.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "platform_storage" {
  bucket = aws_s3_bucket.platform_storage.id

  rule {
    id     = "audit-archival"
    status = "Enabled"

    filter {
      prefix = "audit/"
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }

  rule {
    id     = "dlq-cleanup"
    status = "Enabled"

    filter {
      prefix = "dlq/"
    }

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "platform_storage" {
  bucket = aws_s3_bucket.platform_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "platform_storage" {
  bucket = aws_s3_bucket.platform_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
