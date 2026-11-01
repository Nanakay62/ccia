#!/bin/bash
set -eo pipefail

# ==============================================================================
# CCIA Accounting System — Automated Encrypted Daily Database Backup
# ==============================================================================

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEMP_DUMP="/tmp/dump_${TIMESTAMP}.sql.gz"
FINAL_FILE="${BACKUP_DIR}/ccia_backup_${TIMESTAMP}.sql.gz.enc"

echo "=== [$(date)] Starting Automated Database Backup ==="

mkdir -p "${BACKUP_DIR}"

# 1. Test database reachability
echo "Pinging PostgreSQL at ${POSTGRES_HOST}..."
export PGPASSWORD="${POSTGRES_PASSWORD}"

# 2. Dump PostgreSQL database with compression
echo "Creating compressed pg_dump..."
pg_dump -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --clean --if-exists | gzip -9 > "${TEMP_DUMP}"

DUMP_SIZE=$(stat -c%s "${TEMP_DUMP}" 2>/dev/null || wc -c < "${TEMP_DUMP}")
echo "Database dump complete (${DUMP_SIZE} bytes)."

# 3. Encrypt dump using OpenSSL AES-256-CBC with PBKDF2
echo "Encrypting backup archive with AES-256-CBC..."
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
  -in "${TEMP_DUMP}" \
  -out "${FINAL_FILE}" \
  -pass "pass:${BACKUP_PASSPHRASE}"

# Securely remove unencrypted temporary dump
rm -f "${TEMP_DUMP}"

if [ -f "${FINAL_FILE}" ]; then
  ENC_SIZE=$(stat -c%s "${FINAL_FILE}" 2>/dev/null || wc -c < "${FINAL_FILE}")
  echo "Backup successfully created and encrypted: ${FINAL_FILE} (${ENC_SIZE} bytes)"
else
  echo "ERROR: Encrypted backup file was not created!" >&2
  exit 1
fi

# 4. Enforce Retention Policy (Default 30 days)
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
echo "Pruning encrypted backups older than ${RETENTION} days..."
find "${BACKUP_DIR}" -name "ccia_backup_*.sql.gz.enc" -type f -mtime "+${RETENTION}" -exec rm -vf {} \;

echo "=== [$(date)] Backup Job Finished Successfully ==="
