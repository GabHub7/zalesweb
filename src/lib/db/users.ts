import { query } from "@/lib/db/pool";
import { encryptSecret, decryptSecret, maskSecret, isEncryptedPayload, UNCHANGED_SENTINEL } from "@/lib/crypto";

export interface UserSettings {
  geminiApiKey?: string;
  googlePlacesApiKey?: string;
  openaiApiKey?: string;
  customBaseUrl?: string;
  customModelName?: string;
  customApiKey?: string;
  rapidApiKey?: string;
  rapidApiHost?: string;
  whatsappSendUrl?: string;
  metaAccessToken?: string;
  metaPhoneNumberId?: string;
  metaWabaId?: string;
  metaVerifyToken?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  cloudinaryFolder?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  supabaseBucket?: string;
}

const SECRET_FIELDS = new Set<keyof UserSettings>([
  "geminiApiKey",
  "googlePlacesApiKey",
  "openaiApiKey",
  "customApiKey",
  "rapidApiKey",
  "cloudinaryApiSecret",
  "supabaseKey",
  "metaAccessToken",
  "metaVerifyToken",
]);

/** Raw read from DB — values are still encrypted. Internal use only. */
async function getRawSettings(userId: string): Promise<UserSettings> {
  const rows = await query<{ settings: UserSettings }>(
    `select settings from users where id = $1`,
    [userId]
  );
  return rows[0]?.settings ?? {};
}

/**
 * Decrypted settings for server-side use only (e.g. passing a fallback key
 * to a background worker/execution route). NEVER send this to the client.
 */
export async function getUserSettingsDecrypted(userId: string): Promise<UserSettings> {
  const raw = await getRawSettings(userId);
  const result: UserSettings = { ...raw };
  for (const field of SECRET_FIELDS) {
    const value = raw[field];
    if (value && isEncryptedPayload(value)) {
      result[field] = decryptSecret(value);
    }
  }
  return result;
}

/**
 * Masked settings safe to send to the client/settings UI — secrets are
 * shown as "sk-a...9xyz" instead of the real value, per spec §5/§6.
 */
export async function getUserSettingsMasked(userId: string): Promise<UserSettings> {
  const decrypted = await getUserSettingsDecrypted(userId);
  const result: UserSettings = { ...decrypted };
  for (const field of SECRET_FIELDS) {
    const value = decrypted[field];
    if (value) result[field] = maskSecret(value);
  }
  return result;
}

/**
 * Updates settings. Any secret field equal to UNCHANGED_SENTINEL (or left
 * out) keeps its existing encrypted value instead of overwriting it with a
 * masked placeholder — this is what lets the UI show "sk-a...9xyz" without
 * ever round-tripping the real key back through a save.
 */
export async function updateUserSettings(
  userId: string,
  incoming: UserSettings
): Promise<UserSettings> {
  const currentRaw = await getRawSettings(userId);
  const merged: UserSettings = { ...currentRaw };

  for (const [key, value] of Object.entries(incoming) as [keyof UserSettings, string | undefined][]) {
    if (value === undefined || value === UNCHANGED_SENTINEL) continue;
    if (SECRET_FIELDS.has(key)) {
      merged[key] = value === "" ? "" : encryptSecret(value);
    } else {
      merged[key] = value;
    }
  }

  await query(`update users set settings = $2::jsonb where id = $1`, [
    userId,
    JSON.stringify(merged),
  ]);

  return getUserSettingsMasked(userId);
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  timezone: string;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  hasPassword: boolean;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const rows = await query<{
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    timezone: string;
    created_at: string;
    last_login_at: string | null;
    login_count: number;
    password_hash: string | null;
  }>(
    `select id, email, name, image, timezone, created_at, last_login_at, login_count, password_hash
     from users where id = $1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    timezone: row.timezone,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count,
    hasPassword: !!row.password_hash,
  };
}

export async function updateUserProfile(
  userId: string,
  fields: { name?: string; timezone?: string }
): Promise<void> {
  if (fields.name !== undefined) {
    await query(`update users set name = $2 where id = $1`, [userId, fields.name.slice(0, 120)]);
  }
  if (fields.timezone !== undefined) {
    await query(`update users set timezone = $2 where id = $1`, [userId, fields.timezone.slice(0, 60)]);
  }
}

export async function recordLoginEvent(userId: string, ip: string | null, userAgent: string | null) {
  await query(
    `update users set last_login_at = now(), login_count = login_count + 1 where id = $1`,
    [userId]
  );
  await query(
    `insert into login_events (user_id, ip, user_agent) values ($1, $2, $3)`,
    [userId, ip, userAgent]
  );
}

export async function getRecentLoginEvents(userId: string, limit = 10) {
  return query<{ id: string; ip: string | null; user_agent: string | null; created_at: string }>(
    `select id, ip, user_agent, created_at from login_events
     where user_id = $1 order by created_at desc limit $2`,
    [userId, limit]
  );
}

export async function countUserWorkflows(userId: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `select count(*)::text as count from workflows where user_id = $1`,
    [userId]
  );
  return Number(rows[0]?.count ?? 0);
}

export async function deleteUserAccount(userId: string): Promise<void> {
  // workflows.user_id cascades; login_events / password_reset_tokens cascade too.
  await query(`delete from users where id = $1`, [userId]);
}
