// Simple in-memory store for connected accounts and snapshots.
// In production, replace with a real database (Postgres, Supabase, etc.)

import { Account, Snapshot } from "./mock-data";

declare global {
  // eslint-disable-next-line no-var
  var __adsStore: {
    accounts: Map<string, Account>;
    snapshots: Snapshot[];
  };
}

if (!global.__adsStore) {
  global.__adsStore = {
    accounts: new Map(),
    snapshots: [],
  };
}

export const store = global.__adsStore;

export function saveAccount(account: Account) {
  store.accounts.set(account.id, account);
}

export function getAccount(id: string): Account | undefined {
  return store.accounts.get(id);
}

export function getAllAccounts(): Account[] {
  return Array.from(store.accounts.values());
}

export function saveSnapshot(snapshot: Snapshot) {
  store.snapshots.unshift(snapshot);
  // Keep only last 500 snapshots
  if (store.snapshots.length > 500) store.snapshots.length = 500;
}

export function getSnapshotsByAccount(accountId: string): Snapshot[] {
  return store.snapshots.filter((s) => s.accountId === accountId);
}
