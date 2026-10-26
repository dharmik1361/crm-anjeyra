#!/usr/bin/env bash
# Run on the EC2 box (CI calls it over SSH): refresh env from SSM, pull images, restart.
set -euo pipefail
cd /opt/quotefollow
aws ssm get-parameters-by-path --region ap-south-1 --path /quotefollow/prod --with-decryption \
  --query 'Parameters[*].[Name,Value]' --output text \
  | awk '{ n=$1; sub(".*/", "", n); $1=""; sub(/^ /, ""); print n "=" $0 }' > .env.new
mv .env.new .env && chmod 600 .env
export TAG="${1:-latest}"
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
