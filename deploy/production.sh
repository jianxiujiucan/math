#!/usr/bin/env bash
set -Eeuo pipefail

# This script runs on the production server. The live paths stay unchanged,
# so the existing systemd and Nginx configuration does not need modification.
readonly APP_DIR="/opt/math-challenge"
readonly SERVICE_NAME="math-challenge.service"
readonly LOCAL_HEALTH_URL="http://127.0.0.1:3010/api/health"
readonly PUBLIC_HEALTH_URL="https://jianxiujiucan.cn/math/api/health"

revision="${1:-}"
archive="${2:-}"

if [[ ! "${revision}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Expected a full Git commit SHA as the first argument." >&2
  exit 2
fi

if [[ -z "${archive}" || ! -f "${archive}" ]]; then
  echo "Deployment archive not found: ${archive}" >&2
  exit 2
fi

for command_name in tar npm systemctl curl flock; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "Required server command is missing: ${command_name}" >&2
    exit 2
  }
done

[[ -d "${APP_DIR}/math-src" ]] || {
  echo "Missing live frontend directory." >&2
  exit 2
}
[[ -d "${APP_DIR}/math-server" ]] || {
  echo "Missing live backend directory." >&2
  exit 2
}
[[ -s "${APP_DIR}/math-server/.dev.vars" ]] || {
  echo "Production .dev.vars is missing; deployment stopped before any changes." >&2
  exit 2
}

# Prevent two manually started or CI-started server deployments from racing.
exec 9>"${APP_DIR}/.production-deploy.lock"
if ! flock -n 9; then
  echo "Another production deployment is already running." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
work_dir="${APP_DIR}/.deploy-staging-${timestamp}-${revision}"
backup_dir="${APP_DIR}/.deploy-backup-${timestamp}-${revision}"
failed_dir="${APP_DIR}/.deploy-failed-${timestamp}-${revision}"
staging_dir="${work_dir}/package"
switched=0
committed=0

wait_for_health() {
  local url="$1"
  local attempts="$2"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl -fsS --max-time 3 "${url}" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

rollback() {
  echo "Deployment verification failed; restoring the previous release." >&2
  local restored=0
  set +e

  if [[ -d "${backup_dir}/math-src" || -d "${backup_dir}/math-server" ]]; then
    systemctl stop "${SERVICE_NAME}"
  fi

  if [[ -d "${backup_dir}/math-src" ]]; then
    if [[ -d "${APP_DIR}/math-src" ]]; then
      mv "${APP_DIR}/math-src" "${failed_dir}/math-src"
    fi
    mv "${backup_dir}/math-src" "${APP_DIR}/math-src"
    restored=1
  fi
  if [[ -d "${backup_dir}/math-server" ]]; then
    if [[ -d "${APP_DIR}/math-server" ]]; then
      mv "${APP_DIR}/math-server" "${failed_dir}/math-server"
    fi
    mv "${backup_dir}/math-server" "${APP_DIR}/math-server"
    restored=1
  fi

  if [[ "${restored}" -eq 0 ]]; then
    echo "No live files had been switched; no rollback is necessary." >&2
    return
  fi

  systemctl restart "${SERVICE_NAME}"

  if wait_for_health "${LOCAL_HEALTH_URL}" 30; then
    echo "Previous release restored and healthy." >&2
  else
    echo "Previous release was restored, but its health check still fails." >&2
    echo "Inspect: journalctl -u ${SERVICE_NAME} -n 100 --no-pager" >&2
  fi
}

on_exit() {
  local exit_code=$?

  if [[ "${switched}" -eq 1 && "${committed}" -eq 0 ]]; then
    rollback
  fi

  rm -rf -- "${work_dir}"
  if [[ "${committed}" -eq 0 ]]; then
    rmdir "${backup_dir}" 2>/dev/null || true
  fi
  rmdir "${failed_dir}" 2>/dev/null || true
  return "${exit_code}"
}
trap on_exit EXIT

mkdir -p "${staging_dir}" "${backup_dir}" "${failed_dir}"
tar -xzf "${archive}" -C "${staging_dir}"

[[ -d "${staging_dir}/math-src/dist" ]] || {
  echo "Frontend build output is absent from the package." >&2
  exit 1
}
[[ -f "${staging_dir}/math-server/src/node.ts" ]] || {
  echo "Backend source is absent from the package." >&2
  exit 1
}
[[ -f "${staging_dir}/math-server/package-lock.json" ]] || {
  echo "Backend lockfile is absent from the package." >&2
  exit 1
}

# Install into staging so dependency failures never touch the live release.
npm ci --omit=dev --prefix "${staging_dir}/math-server"
cp -p "${APP_DIR}/math-server/.dev.vars" "${staging_dir}/math-server/.dev.vars"
chmod 600 "${staging_dir}/math-server/.dev.vars"

echo "Switching production to ${revision}."
switched=1
mv "${APP_DIR}/math-src" "${backup_dir}/math-src"
mv "${APP_DIR}/math-server" "${backup_dir}/math-server"
mv "${staging_dir}/math-src" "${APP_DIR}/math-src"
mv "${staging_dir}/math-server" "${APP_DIR}/math-server"

systemctl restart "${SERVICE_NAME}"
wait_for_health "${LOCAL_HEALTH_URL}" 30 || {
  journalctl -u "${SERVICE_NAME}" -n 80 --no-pager || true
  exit 1
}
wait_for_health "${PUBLIC_HEALTH_URL}" 10 || {
  echo "Local API is healthy, but the public HTTPS health check failed." >&2
  exit 1
}

committed=1
echo "Production is healthy at ${PUBLIC_HEALTH_URL}"

# Keep five known-good backups. Only this script's timestamped directories
# directly under APP_DIR are eligible for removal.
shopt -s nullglob
backups=("${APP_DIR}"/.deploy-backup-*)
if (( ${#backups[@]} > 5 )); then
  mapfile -t sorted_backups < <(printf '%s\n' "${backups[@]}" | sort)
  removable_count=$(( ${#sorted_backups[@]} - 5 ))
  for ((index = 0; index < removable_count; index++)); do
    candidate="${sorted_backups[index]}"
    case "${candidate}" in
      "${APP_DIR}"/.deploy-backup-*)
        rm -rf -- "${candidate}" || echo "Warning: could not remove old backup ${candidate}." >&2
        ;;
    esac
  done
fi
