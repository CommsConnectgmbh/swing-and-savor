#!/bin/zsh
# Fuehrt die Deno-E2E-Tests der Edge Functions aus (echter Funktionscode, externe Dienste gemockt).
set -u
cd "$(dirname $0)"
rc=0
for a in boost premium pro; do deno run -A --node-modules-dir=none --no-lock checkout.deno.ts $a || rc=1; done
deno run -A --node-modules-dir=none --no-lock newsletter.deno.ts || rc=1
exit $rc
