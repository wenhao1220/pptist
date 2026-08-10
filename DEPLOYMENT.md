# Deployment

The production image serves the Vue application and `/api` from the same Express
process. Bedrock settings stay in the server-side `.env` file.

## Local production check

1. Copy `.env.example` to `.env` and fill in the existing Bedrock values.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000` and verify `http://localhost:3000/health`.

## Hosted deployment

Deploy the Dockerfile to a container host and configure the four `BEDROCK_*`
values as server-side secrets. Do not define `VITE_AI_API_BASE_URL` when using
the single-container deployment: the browser will call the same secure origin.
