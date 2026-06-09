# =============================================================================
# Step Functions — Orchestration State Machine
# =============================================================================

resource "aws_sfn_state_machine" "orchestration" {
  name     = "${var.project_name}-orchestration-workflow"
  role_arn = aws_iam_role.step_functions.arn

  definition = jsonencode({
    Comment = "ForgeAdmin orchestration workflow"
    StartAt = "Triage"
    States = {
      Triage = {
        Type   = "Pass"
        Result = { status = "triaged" }
        Next   = "Research"
      }
      Research = {
        Type   = "Pass"
        Result = { status = "researched" }
        Next   = "Planning"
      }
      Planning = {
        Type   = "Pass"
        Result = { status = "planned" }
        Next   = "Verification"
      }
      Verification = {
        Type   = "Pass"
        Result = { status = "verified" }
        Next   = "Complete"
      }
      Complete = {
        Type = "Succeed"
      }
    }
  })

  tags = {
    Name = "${var.project_name}-orchestration-workflow"
  }
}
