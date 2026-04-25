import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canSendEmail,
  sendExecutionRiskUpdateEmail,
  sendLaunchThreadEmail,
  sendLeaderboardSpotlightEmail,
  sendTradingLiveAnnouncementEmail,
  sendWelcomeWithAccessCode,
} from "./email.js";

const MAX_CAMPAIGN_RECIPIENTS = 2_000;

type WaitlistAudienceRow = {
  id: string;
  email: string | null;
  name: string | null;
  access_code: string | null;
  access_code_used_at: string | null;
  created_at: string | null;
  wallet: string | null;
};

type UserAudienceRow = {
  id: string;
  wallet: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  signup_source: string | null;
  country: string | null;
  metadata: Record<string, unknown> | null;
};

type CampaignRecipient = {
  email: string;
  name: string | null;
  waitlistId: string | null;
  accessCode: string | null;
  accessCodeUsedAt: string | null;
  source: "waitlist" | "app" | "both";
};

type CampaignAudience = "waitlist" | "merged_contacts";

type CampaignStats = {
  waitlistWithEmail: number;
  waitlistMissingCodes: number;
  reachableContacts: number;
  attemptedAtLeastOneTrade: number;
  attemptedThreePlusTrades: number;
};

export type EmailCampaignId =
  | "access_codes"
  | "launch_thread"
  | "execution_risk_update"
  | "trading_live"
  | "leaderboard_spotlight";

export type EmailCampaignPreset = {
  id: EmailCampaignId;
  label: string;
  description: string;
  endpoint: string;
  audienceLabel: string;
  eligibleContacts: number;
  recommended: boolean;
};

type EmailCampaignDefinition = {
  id: EmailCampaignId;
  label: string;
  description: string;
  audience: CampaignAudience;
  audienceLabel: string;
  eligibleContacts: (stats: CampaignStats) => number;
  recommended: (stats: CampaignStats) => boolean;
  send: (args: {
    client: SupabaseClient;
    recipient: CampaignRecipient;
  }) => Promise<{ ok: boolean; error?: string }>;
};

function normalizeEmail(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function cleanString(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getUserEmail(row: UserAudienceRow): string | null {
  return normalizeEmail(
    getMetadataString(row.metadata, ["email", "contact_email", "primary_email", "privy_email", "google_email", "github_email"]),
  );
}

function getUserName(row: UserAudienceRow): string | null {
  return cleanString(
    getMetadataString(row.metadata, ["display_name", "full_name", "name", "username", "handle"]),
  );
}

function buildMergedAudienceRecipients(waitlistRows: WaitlistAudienceRow[], userRows: UserAudienceRow[]): CampaignRecipient[] {
  const merged = new Map<
    string,
    {
      email: string;
      name: string | null;
      waitlistId: string | null;
      accessCode: string | null;
      accessCodeUsedAt: string | null;
      seenWaitlist: boolean;
      seenApp: boolean;
      createdAt: string | null;
      lastSeenAt: string | null;
    }
  >();

  for (const row of waitlistRows) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    const existing = merged.get(email) ?? {
      email,
      name: null,
      waitlistId: null,
      accessCode: null,
      accessCodeUsedAt: null,
      seenWaitlist: false,
      seenApp: false,
      createdAt: null,
      lastSeenAt: null,
    };
    if (!existing.name && row.name) existing.name = cleanString(row.name);
    if (!existing.waitlistId && row.id) existing.waitlistId = row.id;
    if (!existing.accessCode && row.access_code) existing.accessCode = cleanString(row.access_code);
    if (!existing.accessCodeUsedAt && row.access_code_used_at) existing.accessCodeUsedAt = row.access_code_used_at;
    if (!existing.createdAt && row.created_at) existing.createdAt = row.created_at;
    existing.seenWaitlist = true;
    merged.set(email, existing);
  }

  for (const row of userRows) {
    const email = getUserEmail(row);
    if (!email) continue;
    const existing = merged.get(email) ?? {
      email,
      name: null,
      waitlistId: null,
      accessCode: null,
      accessCodeUsedAt: null,
      seenWaitlist: false,
      seenApp: false,
      createdAt: null,
      lastSeenAt: null,
    };
    if (!existing.name) existing.name = getUserName(row);
    if (!existing.createdAt && row.created_at) existing.createdAt = row.created_at;
    if (!existing.lastSeenAt && row.last_seen_at) existing.lastSeenAt = row.last_seen_at;
    existing.seenApp = true;
    merged.set(email, existing);
  }

  return Array.from(merged.values()).map((row) => ({
    email: row.email,
    name: row.name,
    waitlistId: row.waitlistId,
    accessCode: row.accessCode,
    accessCodeUsedAt: row.accessCodeUsedAt,
    source: row.seenWaitlist && row.seenApp ? "both" : row.seenApp ? "app" : "waitlist",
  }));
}

async function fetchWaitlistAudience(client: SupabaseClient): Promise<WaitlistAudienceRow[]> {
  const { data, error } = await client
    .from("waitlist_signups")
    .select("id,email,name,access_code,access_code_used_at,created_at,wallet")
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(MAX_CAMPAIGN_RECIPIENTS);

  if (error) throw error;
  return data ?? [];
}

async function fetchAppAudience(client: SupabaseClient): Promise<UserAudienceRow[]> {
  const { data, error } = await client
    .from("users")
    .select("id,wallet,created_at,last_seen_at,signup_source,country,metadata")
    .order("created_at", { ascending: true })
    .limit(MAX_CAMPAIGN_RECIPIENTS);

  if (error) throw error;
  return data ?? [];
}

async function ensureWaitlistAccessCode(client: SupabaseClient, recipient: CampaignRecipient): Promise<string | null> {
  if (recipient.accessCode) return recipient.accessCode;
  if (!recipient.waitlistId) return null;

  const generated = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
  const { error } = await client
    .from("waitlist_signups")
    .update({ access_code: generated, access_code_used_at: null })
    .eq("id", recipient.waitlistId);

  if (error) throw error;
  recipient.accessCode = generated;
  return generated;
}

const EMAIL_CAMPAIGN_DEFINITIONS: readonly EmailCampaignDefinition[] = [
  {
    id: "access_codes",
    label: "Access code drop",
    description: "Generate missing codes in code and send the welcome unlock email to the waitlist.",
    audience: "waitlist",
    audienceLabel: "Waitlist emails",
    eligibleContacts: (stats) => stats.waitlistWithEmail,
    recommended: (stats) => stats.waitlistMissingCodes > 0,
    send: async ({ client, recipient }) => {
      const code = await ensureWaitlistAccessCode(client, recipient);
      if (!code) return { ok: false, error: "Recipient has no waitlist row for code generation." };
      return sendWelcomeWithAccessCode({ to: recipient.email, name: recipient.name, code });
    },
  },
  {
    id: "launch_thread",
    label: "Launch thread blast",
    description: "Drive narrative and distribution with the launch-story email to the merged audience.",
    audience: "merged_contacts",
    audienceLabel: "Merged audience",
    eligibleContacts: (stats) => stats.reachableContacts,
    recommended: (stats) => stats.reachableContacts > 0 && stats.attemptedAtLeastOneTrade === 0,
    send: async ({ recipient }) => sendLaunchThreadEmail({ to: recipient.email, name: recipient.name }),
  },
  {
    id: "execution_risk_update",
    label: "Execution and risk update",
    description: "Ship the sharper wedge update when you want the market to hear the new Siren story.",
    audience: "merged_contacts",
    audienceLabel: "Merged audience",
    eligibleContacts: (stats) => stats.reachableContacts,
    recommended: (stats) => stats.reachableContacts > 0,
    send: async ({ recipient }) => sendExecutionRiskUpdateEmail({ to: recipient.email, name: recipient.name }),
  },
  {
    id: "trading_live",
    label: "Trading live announcement",
    description: "Pull the audience back into the app once trading and account flows are solid enough to invite people in.",
    audience: "merged_contacts",
    audienceLabel: "Merged audience",
    eligibleContacts: (stats) => stats.reachableContacts,
    recommended: (stats) => stats.reachableContacts > 0 && stats.attemptedAtLeastOneTrade > 0,
    send: async ({ recipient }) => sendTradingLiveAnnouncementEmail({ to: recipient.email, name: recipient.name }),
  },
  {
    id: "leaderboard_spotlight",
    label: "Leaderboard spotlight",
    description: "Broadcast proof of activity and pull traders back in around competitive status.",
    audience: "merged_contacts",
    audienceLabel: "Merged audience",
    eligibleContacts: (stats) => stats.reachableContacts,
    recommended: (stats) => stats.reachableContacts > 0 && stats.attemptedThreePlusTrades > 0,
    send: async ({ recipient }) => sendLeaderboardSpotlightEmail({ to: recipient.email, name: recipient.name }),
  },
] as const;

export function getEmailCampaignDefinition(id: string): EmailCampaignDefinition | null {
  return EMAIL_CAMPAIGN_DEFINITIONS.find((campaign) => campaign.id === id) ?? null;
}

export function buildEmailCampaignPresets(stats: CampaignStats): EmailCampaignPreset[] {
  return EMAIL_CAMPAIGN_DEFINITIONS.map((campaign) => ({
    id: campaign.id,
    label: campaign.label,
    description: campaign.description,
    endpoint: `/api/admin/email-campaigns/${campaign.id}/send`,
    audienceLabel: campaign.audienceLabel,
    eligibleContacts: campaign.eligibleContacts(stats),
    recommended: campaign.recommended(stats),
  }));
}

export async function runEmailCampaign(client: SupabaseClient, id: string) {
  const definition = getEmailCampaignDefinition(id);
  if (!definition) {
    return null;
  }

  const waitlistRows = await fetchWaitlistAudience(client);
  const waitlistRecipients: CampaignRecipient[] = waitlistRows.flatMap((row) => {
    const email = normalizeEmail(row.email);
    if (!email) return [];
    return [
      {
        email,
        name: cleanString(row.name),
        waitlistId: row.id,
        accessCode: cleanString(row.access_code),
        accessCodeUsedAt: row.access_code_used_at,
        source: "waitlist" as const,
      },
    ];
  });
  const recipients =
    definition.audience === "waitlist"
      ? waitlistRecipients
      : buildMergedAudienceRecipients(waitlistRows, await fetchAppAudience(client));

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const failedEmails: string[] = [];
  const skippedEmails: string[] = [];

  for (const recipient of recipients) {
    if (!canSendEmail()) {
      skipped += 1;
      skippedEmails.push(recipient.email);
      continue;
    }

    try {
      const result = await definition.send({ client, recipient });
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        failedEmails.push(recipient.email);
      }
    } catch (error) {
      failed += 1;
      failedEmails.push(recipient.email);
    }
  }

  return {
    campaign: {
      id: definition.id,
      label: definition.label,
      audienceLabel: definition.audienceLabel,
    },
    sent,
    failed,
    skipped,
    total: recipients.length,
    failedEmails,
    skippedEmails,
  };
}
