# =============================================================================
# S3 — Knowledge Base Buckets
# =============================================================================

resource "aws_s3_bucket" "kb_source_documents" {
  bucket        = "${var.project_name}-kb-source-documents-${var.environment}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-kb-source-documents"
  }
}

resource "aws_s3_bucket_versioning" "kb_source_documents" {
  bucket = aws_s3_bucket.kb_source_documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket" "runbooks" {
  bucket        = "${var.project_name}-kb-runbooks-${var.environment}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-kb-runbooks"
  }
}

resource "aws_s3_bucket_versioning" "runbooks" {
  bucket = aws_s3_bucket.runbooks.id

  versioning_configuration {
    status = "Enabled"
  }
}
