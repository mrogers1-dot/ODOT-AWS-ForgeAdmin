// scripts/seed-knowledge-base.ts
// Usage: pnpm tsx scripts/seed-knowledge-base.ts [environment]
//
// Uploads all markdown files from seed-runbooks/ to the KB S3 bucket
// and triggers a Bedrock Knowledge Base re-index job.

import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REGION = 'us-east-2';
const environment = process.argv[2] || 'dev';
const seedDir = resolve(__dirname, '..', 'seed-runbooks');

function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function getSSMParam(name: string): string {
  try {
    return run(
      `aws ssm get-parameter --name "${name}" --region ${REGION} --query "Parameter.Value" --output text`
    );
  } catch {
    throw new Error(`SSM parameter not found: ${name}. Has the knowledge-base context been deployed?`);
  }
}

function getMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isFile() && entry.endsWith('.md') && entry !== 'README.md') {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  console.log(`[INFO] Seeding Knowledge Base (${environment})`);

  // Resolve bucket and KB IDs from SSM
  const bucketName = getSSMParam(`/forgeadmin/${environment}/kb-bucket-name`);
  const kbId = getSSMParam(`/forgeadmin/${environment}/knowledge-base-id`);
  const dataSourceId = getSSMParam(`/forgeadmin/${environment}/kb-data-source-id`);

  console.log(`[INFO] KB Bucket: ${bucketName}`);
  console.log(`[INFO] Knowledge Base ID: ${kbId}`);
  console.log(`[INFO] Data Source ID: ${dataSourceId}`);

  // Find all markdown files
  const files = getMarkdownFiles(seedDir);
  if (files.length === 0) {
    console.log('[WARN] No markdown files found in seed-runbooks/. Add .md files and re-run.');
    process.exit(0);
  }

  console.log(`[INFO] Found ${files.length} runbook(s) to upload`);

  // Upload to S3
  const s3Prefix = 'knowledge-base/seed';
  run(`aws s3 sync "${seedDir}" "s3://${bucketName}/${s3Prefix}/" --exclude "README.md" --region ${REGION}`);
  console.log(`[INFO] Uploaded ${files.length} file(s) to s3://${bucketName}/${s3Prefix}/`);

  // Trigger re-index
  console.log('[INFO] Triggering Bedrock Knowledge Base ingestion job...');
  const jobResult = run(
    `aws bedrock-agent start-ingestion-job --knowledge-base-id "${kbId}" --data-source-id "${dataSourceId}" --region ${REGION}`
  );
  console.log('[INFO] Ingestion job started:', jobResult);

  console.log('[INFO] === Seed Complete ===');
  console.log('[INFO] The Knowledge Base will be updated once the ingestion job completes (typically 1-5 minutes).');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
