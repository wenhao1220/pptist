# Deployment

The production image serves the Vue application and `/api` from the same Express
process. The browser calls the same origin, so AI credentials stay on the server.

## Local production check

1. Copy `.env.example` to `.env` and fill in the existing Bedrock values.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000` and verify `http://localhost:3000/health`.

## AWS / EC2 security baseline

Before exposing the application, use an EC2 instance behind an ALB or restrict
the EC2 security group to your company VPN/IP range. Do **not** expose port
3000 to `0.0.0.0/0`.

1. Assign the EC2 instance an IAM role with only the Bedrock model invocation
   permissions required by this app. Prefer the role over long-lived AWS keys.
2. Store `BEDROCK_*` and `GOOGLE_FEEDBACK_*` values in AWS Secrets Manager or
   SSM Parameter Store. If a temporary `.env` is used on EC2, create it with
   `chmod 600 .env`, never commit it, and never put secrets in `VITE_*` values.
3. Set `CORS_ORIGIN` to the exact HTTPS domain(s) that may load the browser
   application. For same-origin Express hosting it may stay empty; all other
   browser origins will be rejected in production.
4. When running behind an AWS ALB, set `TRUST_PROXY=true` so API rate limits use
   the real client IP. Keep `API_RATE_LIMIT_MAX` and `UPLOAD_MAX_BYTES` at or
   below the documented defaults unless a review approves higher values.
5. Terminate TLS at the ALB with ACM, redirect HTTP to HTTPS, and allow inbound
   traffic to EC2 only from the ALB security group. Restrict SSH (22) to a
   company VPN/bastion host; prefer AWS Systems Manager Session Manager.

## Container variables

Configure these as server-side secrets/variables:

- `BEDROCK_API_KEY`, `BEDROCK_REGION`, `BEDROCK_MODEL_ID`, `BEDROCK_ENDPOINT`
- `GOOGLE_FEEDBACK_WEBHOOK_URL`, `GOOGLE_FEEDBACK_TOKEN` (if feedback is used)
- `CORS_ORIGIN`, `TRUST_PROXY`, `API_RATE_LIMIT_MAX`, `UPLOAD_MAX_BYTES`

Do not define `VITE_AI_API_BASE_URL` for the single-container deployment.
