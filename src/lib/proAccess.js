// Per-USER "Pro" entitlement check.
//
// IMPORTANT — design note: the existing Stripe "premium" flow
// (`create-premium-checkout`) upgrades a *tournament/cup* (`tournaments.package_type`),
// not a person. The launch monitor is a personal, per-device practice tool, so it
// needs a per-user entitlement. This module reads that entitlement from the
// `profiles` row (`pro_until` timestamp, set when a `pro_entitlements` purchase is
// activated — see migration 033 + `create-pro-checkout`).
//
// Keep this the single source of truth for "is this user Pro?" so the exact product
// (lifetime vs. subscription, or a future StoreKit IAP entitlement) can change in
// one place without touching the gating UI.

import { useAuth } from './auth'

// Pure predicate — safe to call anywhere with a profile row (or null).
export function isPro(profile) {
  if (!profile) return false
  if (profile.is_pro === true) return true // optional lifetime flag
  if (profile.pro_until && new Date(profile.pro_until) > new Date()) return true
  return false
}

// React hook — resolves the current signed-in user's Pro state.
export function useProAccess() {
  const { profile } = useAuth()
  return isPro(profile)
}
