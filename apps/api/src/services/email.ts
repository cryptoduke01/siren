import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
/** Display name is the first part (e.g. Duke). Use a verified domain in production. */
const FROM = process.env.SIREN_EMAIL_FROM || "Duke <onboarding@resend.dev>";
const APP_URL = (process.env.SIREN_APP_URL || "https://onsiren.xyz").replace(/\/+$/, "");
const DOCS_URL = "https://docs.onsiren.xyz";
const X_URL = "https://x.com/sirenmarketsxyz";
const LAUNCH_THREAD_URL = "https://x.com/cryptoduke01/status/2037410069109768374";
const LAUNCH_THREAD_TITLE = "Prediction Markets, Execution, and Risk";
const LAUNCH_THREAD_PREVIEW =
  "There is a particular kind of suffering that belongs only to the man who sees what is coming and cannot make anyone believe him.";
const LAUNCH_THREAD_IMAGE_URL = `${APP_URL}/emails/launch-thread-cover.jpg`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { message?: string; statusCode?: number; name?: string };
  return (
    maybeError.statusCode === 429 ||
    /429|rate limit|too many requests/i.test(maybeError.message || "") ||
    /rate limit/i.test(maybeError.name || "")
  );
}

async function sendEmailWithRetry(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured" };

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    if (!error) return { ok: true };
    lastError = error;

    if (!isRateLimitError(error) || attempt === 3) break;
    await sleep(700 * (attempt + 1));
  }

  const message = lastError && typeof lastError === "object" && "message" in lastError
    ? String((lastError as { message?: string }).message || "Email send failed")
    : "Email send failed";

  return { ok: false, error: message };
}

export function canSendEmail(): boolean {
  return !!resend;
}

export async function sendWelcomeWithAccessCode(params: {
  to: string;
  name: string | null;
  code: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured" };

  const greeting = params.name ? `Hi ${params.name}` : "Hi there";
  const logoUrl = `${APP_URL}/brand/mark.svg`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Siren access code</title>
</head>
<body style="margin:0;padding:0;font-family:'Georgia', 'Times New Roman', serif;background:#0c0c0e;color:#e8e8ec;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0c0c0e;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;border:1px solid #1f1f24;border-radius:8px;background:#121214;">
          <tr>
            <td style="padding:40px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom:32px;border-bottom:1px solid #1f1f24;">
                    <img src="${logoUrl}" alt="Siren" width="120" height="32" style="display:block;height:32px;width:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:32px;">
                    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;font-family:'Georgia', serif;color:#f4f4f6;">
                      You're in - welcome to Siren
                    </h1>
                    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#a1a1aa;">
                      ${greeting},
                    </p>
                    <p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:#a1a1aa;">
                      You're among the first to access Siren — execution and risk intelligence for prediction markets on Solana. Use your one-time access code below to unlock the app.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                      <tr>
                        <td style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:24px;text-align:center;">
                          <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#71717a;">Your access code</p>
                          <p style="margin:0;font-size:28px;font-weight:600;font-family:Monaco,'Consolas',monospace;letter-spacing:0.3em;color:#22c55e;">${params.code}</p>
                          <p style="margin:12px 0 0;font-size:12px;color:#71717a;">One-time use • Enter at onsiren.xyz</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#f4f4f6;">How to get started:</p>
                    <ol style="margin:0 0 28px;padding-left:20px;font-size:15px;line-height:1.7;color:#a1a1aa;">
                      <li>Go to <a href="${APP_URL}" style="color:#22c55e;text-decoration:none;">onsiren.xyz</a></li>
                      <li>Enter your 6-digit code when prompted</li>
                      <li>Connect your wallet or sign in with Google or GitHub</li>
                      <li>Browse Kalshi and Polymarket markets with execution-aware tooling</li>
                    </ol>
                    <a href="${APP_URL}" style="display:inline-block;background:#22c55e;color:#0c0c0e;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                      Open Siren ->
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:36px;border-top:1px solid #1f1f24;margin-top:32px;">
                    <p style="margin:0 0 16px;font-size:13px;color:#71717a;">
                      <a href="${DOCS_URL}" style="color:#71717a;text-decoration:underline;">Docs</a> · <a href="${X_URL}" style="color:#71717a;text-decoration:underline;">X @sirenmarketsxyz</a>
                    </p>
                    <p style="margin:0;font-size:12px;color:#52525b;">
                      (c) ${new Date().getFullYear()} Siren · onsiren.xyz
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = [
    `${greeting},`,
    "You're in - welcome to Siren.",
    `Your one-time access code is: ${params.code}`,
    `Open Siren: ${APP_URL}`,
    "Enter your 6-digit code, connect your wallet or sign in, and start trading prediction markets with execution-aware tooling on Solana.",
  ].join("\n\n");

  return sendEmailWithRetry({
    to: params.to,
    subject: "Your Siren access code - you're in",
    html,
    text,
  });
}

export async function sendLaunchThreadEmail(params: {
  to: string;
  name?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured" };

  const greeting = params.name ? `Hi ${params.name}` : "Hi there";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>The official Siren launch thread is live</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4fbf6;color:#111827;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    The official Siren launch thread is out. Read it, show it love on X, and get ready for the thread contest coming soon.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f4fbf6" style="background-color:#f4fbf6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff" style="max-width:680px;border:1px solid #dbe8df;border-radius:30px;background-color:#ffffff;overflow:hidden;">
          <tr>
            <td style="padding:0;border-top:4px solid #00ff85;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f7fffa" style="background-color:#f7fffa;border-bottom:1px solid #dbe8df;">
                <tr>
                  <td style="padding:30px 24px 26px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-bottom:18px;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #d7e6de;border-radius:999px;padding:10px 14px;">
                                <span style="display:inline-block;font-size:18px;font-weight:800;letter-spacing:0.18em;color:#081019;">SIREN</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0 0 12px;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#087443;">
                            Official Launch Thread
                          </p>
                          <h1 style="margin:0 0 14px;font-size:40px;line-height:1.04;font-weight:800;letter-spacing:-0.04em;color:#0f172a;">
                            Siren is live on the timeline.
                          </h1>
                          <p style="margin:0;font-size:18px;line-height:1.7;color:#334155;max-width:560px;">
                            ${greeting}, the official Siren launch thread is out. It tells the story, sets the tone, and gives people their first real feel for what we’re building.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:22px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="padding-bottom:10px;">
                                <a href="${LAUNCH_THREAD_URL}" style="display:block;background:#00c76a;color:#ffffff;font-size:17px;font-weight:800;text-align:center;text-decoration:none;padding:16px 24px;border-radius:16px;">
                                  Read the thread
                                </a>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0;padding-top:2px;font-size:14px;line-height:1.7;color:#4b5563;">
                            Then open Siren at <a href="${APP_URL}" style="color:#0f172a;font-weight:700;text-decoration:underline;">onsiren.xyz</a>.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 24px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;">
                <tr>
                  <td bgcolor="#fcfffd" style="background-color:#fcfffd;border:1px solid #dbe8df;border-radius:24px;overflow:hidden;">
                    <img src="${LAUNCH_THREAD_IMAGE_URL}" alt="${LAUNCH_THREAD_TITLE}" width="564" height="226" style="display:block;width:100%;height:auto;" />
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:22px 22px 24px;">
                          <p style="margin:0 0 8px;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#2563eb;">
                            Launch Story
                          </p>
                          <h2 style="margin:0 0 10px;font-size:32px;line-height:1.14;font-weight:800;color:#0f172a;">
                            ${LAUNCH_THREAD_TITLE}
                          </h2>
                          <p style="margin:0;font-size:17px;line-height:1.75;color:#475569;">
                            ${LAUNCH_THREAD_PREVIEW}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;">
                <tr>
                  <td bgcolor="#f8fffb" style="background-color:#f8fffb;border:1px solid #dbe8df;border-radius:24px;padding:22px;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#0f172a;">
                      What We Need From You
                    </p>
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#334155;">
                      Help us put real wind behind it. If you’re on the waitlist, this is the moment to push the story out a little further.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:0 0 10px;font-size:15px;line-height:1.7;color:#0f172a;">
                          <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:999px;background:#dcfce7;color:#087443;font-size:13px;font-weight:800;margin-right:10px;">1</span>
                          Like the thread
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 10px;font-size:15px;line-height:1.7;color:#0f172a;">
                          <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:999px;background:#dcfce7;color:#087443;font-size:13px;font-weight:800;margin-right:10px;">2</span>
                          Retweet it
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 10px;font-size:15px;line-height:1.7;color:#0f172a;">
                          <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:999px;background:#dcfce7;color:#087443;font-size:13px;font-weight:800;margin-right:10px;">3</span>
                          Comment on it
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;line-height:1.7;color:#0f172a;">
                          <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:999px;background:#dcfce7;color:#087443;font-size:13px;font-weight:800;margin-right:10px;">4</span>
                          Share it with friends who should know about Siren
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;">
                <tr>
                  <td bgcolor="#eef6ff" style="background-color:#eef6ff;border-radius:24px;padding:22px;border:1px solid #d7e6ff;">
                    <p style="margin:0 0 8px;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#2563eb;">
                      Thread Contest Coming Soon
                    </p>
                    <p style="margin:0 0 12px;font-size:17px;line-height:1.75;color:#0f172a;">
                      We’re teeing up a thread contest for the waitlist next. Start warming up your takes, your charts, and your timeline game now.
                    </p>
                    <p style="margin:0;font-size:15px;line-height:1.75;color:#475569;">
                      More details soon. For now, gear up and stay close.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom:12px;">
                    <a href="${LAUNCH_THREAD_URL}" style="display:block;background:#0f172a;color:#f8fafc;font-size:16px;font-weight:800;text-align:center;text-decoration:none;padding:15px 22px;border-radius:16px;">
                      Open the thread on X
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
                You’re receiving this because you joined the Siren waitlist or connected a wallet.
              </p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#fbfefc" style="padding:18px 24px 24px;border-top:1px solid #e6efe8;background-color:#fbfefc;">
              <p style="margin:0 0 8px;font-size:12px;color:#64748b;">
                <a href="${DOCS_URL}" style="color:#475569;text-decoration:underline;">Docs</a> · <a href="${X_URL}" style="color:#475569;text-decoration:underline;">X @sirenmarketsxyz</a>
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                (c) ${new Date().getFullYear()} Siren · onsiren.xyz
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = [
    `${greeting},`,
    "The official Siren launch thread is live.",
    `${LAUNCH_THREAD_TITLE}`,
    LAUNCH_THREAD_PREVIEW,
    `Read the thread: ${LAUNCH_THREAD_URL}`,
    "Help us out by liking it, retweeting it, commenting on it, and sharing it with friends.",
    "A thread contest for the waitlist is coming soon, so gear up.",
    `Open Siren: ${APP_URL}`,
  ].join("\n\n");

  return sendEmailWithRetry({
    to: params.to,
    subject: "The official Siren launch thread is live",
    html,
    text,
  });
}

/** Product announcement: trading, deposits & withdrawals live (replaces legacy launch-thread blast for new campaigns). */
export async function sendTradingLiveAnnouncementEmail(params: {
  to: string;
  name?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured" };

  const greeting = params.name ? `Hi ${params.name}` : "Hi there";
  const logoUrl = `${APP_URL}/brand/mark.svg`;
  const subject = "Siren Is Moving: Follow Our New X Account";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Siren Is Moving</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      body, .mail-shell {
        background: #060609 !important;
      }
      .mail-card {
        background: #10111a !important;
        border-color: #232635 !important;
      }
      .mail-hero {
        background: #0d1712 !important;
        border-bottom-color: #232635 !important;
      }
      .mail-panel {
        background: #151827 !important;
        border-color: #232635 !important;
      }
      .mail-note {
        background: #111522 !important;
        border-color: #2a3150 !important;
      }
      .mail-footer {
        background: #0d1018 !important;
        border-top-color: #232635 !important;
      }
      .text-main {
        color: #f6f7fb !important;
      }
      .text-body {
        color: #c6cfdd !important;
      }
      .text-soft {
        color: #8c96ab !important;
      }
      .text-accent {
        color: #30f2a0 !important;
      }
      .text-link {
        color: #f6f7fb !important;
      }
      .button-main {
        background: #00d977 !important;
        color: #04110a !important;
      }
      .button-secondary {
        background: #151827 !important;
        color: #f6f7fb !important;
        border-color: #232635 !important;
      }
    }
  </style>
</head>
<body class="mail-shell" style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#eef2ef;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Siren has a new X account: @sirenmarketsxyz. Funds and data are safe, Telegram is active, and X login is being removed today.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#eef2ef" style="background-color:#eef2ef;">
    <tr>
      <td align="center" style="padding:28px 14px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="mail-card" bgcolor="#ffffff" style="max-width:620px;border-radius:28px;overflow:hidden;border:1px solid #d8e3dc;background-color:#ffffff;">
          <tr>
            <td style="padding:0;border-top:4px solid #00c76a;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="mail-hero" bgcolor="#f6fdf8" style="background-color:#f6fdf8;border-bottom:1px solid #d8e3dc;">
                <tr>
                  <td style="padding:32px 28px 26px;">
                    <img src="${logoUrl}" alt="Siren" width="112" height="30" style="display:block;height:30px;width:auto;border:0;" />
                    <p class="text-accent" style="margin:22px 0 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#087443;font-weight:800;">
                      Account update
                    </p>
                    <h1 class="text-main" style="margin:10px 0 0;font-size:30px;line-height:1.12;font-weight:800;letter-spacing:-0.03em;color:#0f172a;">
                      Siren has a new X account.
                    </h1>
                    <p class="text-body" style="margin:16px 0 0;font-size:17px;line-height:1.68;color:#334155;">
                      ${greeting}, the old Siren X account was suspended, so we moved. The new official account is <a href="${X_URL}" class="text-link" style="color:#0f172a;font-weight:800;text-decoration:underline;">@sirenmarketsxyz</a>.
                    </p>
                    <p class="text-body" style="margin:16px 0 0;font-size:17px;line-height:1.68;color:#334155;">
                      The important part is simple: <strong class="text-main" style="color:#0f172a;">all user funds and data are safe.</strong> Siren is still live. Wallet balances, deposits, withdrawals, and account data were not affected.
                    </p>
                    <p class="text-body" style="margin:16px 0 0;font-size:17px;line-height:1.68;color:#334155;">
                      A man in motion must meet his fortune, and Siren is very much in motion. To reduce platform risk, we are removing X login from Siren by <strong class="text-main" style="color:#0f172a;">12:00 AM WAT today</strong>. Email, Google, and GitHub login will stay available.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="mail-panel" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #dbe3ea;border-radius:20px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p class="text-soft" style="margin:0 0 10px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;font-weight:800;">
                      What to do now
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td class="text-body" style="padding:0 0 10px;font-size:16px;line-height:1.7;color:#334155;">
                          <span class="text-accent" style="display:inline-block;min-width:22px;font-weight:800;color:#00c76a;">1.</span> Follow the new official X account: <a href="${X_URL}" class="text-link" style="color:#0f172a;font-weight:700;text-decoration:underline;">@sirenmarketsxyz</a>.
                        </td>
                      </tr>
                      <tr>
                        <td class="text-body" style="padding:0 0 10px;font-size:16px;line-height:1.7;color:#334155;">
                          <span class="text-accent" style="display:inline-block;min-width:22px;font-weight:800;color:#00c76a;">2.</span> Join the active Telegram community at <a href="https://t.me/sirenupdates" class="text-link" style="color:#0f172a;font-weight:700;text-decoration:underline;">t.me/sirenupdates</a>.
                        </td>
                      </tr>
                      <tr>
                        <td class="text-body" style="font-size:16px;line-height:1.7;color:#334155;">
                          <span class="text-accent" style="display:inline-block;min-width:22px;font-weight:800;color:#00c76a;">3.</span> Follow the founder account, <a href="https://x.com/cryptoduke01" class="text-link" style="color:#0f172a;font-weight:700;text-decoration:underline;">@cryptoduke01</a>, for founder updates.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="mail-note" bgcolor="#eef7f1" style="background-color:#eef7f1;border:1px solid #cde7d5;border-radius:20px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p class="text-accent" style="margin:0 0 12px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#087443;font-weight:800;">
                      Login change
                    </p>
                    <p class="text-body" style="margin:0;font-size:16px;line-height:1.68;color:#1f3b2e;">
                      We are removing X login from Siren by <strong class="text-main" style="color:#0f172a;">12:00 AM WAT today</strong>. This prevents account suspension issues from affecting access. It does not affect your wallet, balances, or saved account data.
                    </p>
                    <p class="text-body" style="margin:14px 0 0;font-size:16px;line-height:1.68;color:#1f3b2e;">
                      Also, the thread contest is still incoming. Some users may also have trouble checking positions right now. We are fixing that flow and will send an update once it is smooth again.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 28px;" align="center">
              <a href="${X_URL}" class="button-main" style="display:inline-block;background:#00c76a;color:#ffffff;font-size:17px;font-weight:800;text-align:center;text-decoration:none;padding:16px 32px;border-radius:14px;">
                Follow @sirenmarketsxyz
              </a>
              <a href="${APP_URL}" class="button-secondary" style="display:inline-block;background:#ffffff;color:#0f172a;font-size:17px;font-weight:700;text-align:center;text-decoration:none;padding:16px 32px;border-radius:14px;border:1px solid #d8e3dc;margin-top:12px;">
                Open Siren
              </a>
              <p class="text-soft" style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#64748b;">
                Telegram: <a href="https://t.me/sirenupdates" class="text-link" style="color:#0f172a;font-weight:600;">t.me/sirenupdates</a>
                &nbsp;·&nbsp;
                Founder: <a href="https://x.com/cryptoduke01" class="text-link" style="color:#0f172a;font-weight:600;">@cryptoduke01</a>
                &nbsp;·&nbsp;
                Docs: <a href="${DOCS_URL}" class="text-link" style="color:#0f172a;font-weight:600;">docs.onsiren.xyz</a>
              </p>
            </td>
          </tr>
          <tr>
            <td class="mail-footer" bgcolor="#fbfefc" style="padding:18px 28px 22px;border-top:1px solid #e6efe8;background-color:#fbfefc;">
              <p class="text-soft" style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#64748b;">
                You are receiving this because you joined the Siren waitlist or shared your email with us.
              </p>
              <p class="text-soft" style="margin:0;font-size:12px;color:#94a3b8;">
                (c) ${new Date().getFullYear()} Siren · onsiren.xyz
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = [
    subject,
    "",
    `${greeting},`,
    "The old Siren X account was suspended, so we moved. The new official account is @sirenmarketsxyz.",
    "All user funds and data are safe. Siren is still live. Wallet balances, deposits, withdrawals, and account data were not affected.",
    "A man in motion must meet his fortune, and Siren is very much in motion.",
    "We are removing X login from Siren by 12:00 AM WAT today to prevent account suspension issues from affecting access. Email, Google, and GitHub login will stay available.",
    "The thread contest is still incoming.",
    "Some users may have trouble checking positions right now. We are fixing that flow and will send an update once it is smooth again.",
    "",
    `New official X account: ${X_URL}`,
    `Telegram community: https://t.me/sirenupdates`,
    `Founder account: https://x.com/cryptoduke01`,
    `Open Siren: ${APP_URL}`,
    `Docs: ${DOCS_URL}`,
  ].join("\n");

  return sendEmailWithRetry({
    to: params.to,
    subject,
    html,
    text,
  });
}

const LEADERBOARD_URL = `${APP_URL}/leaderboard`;

/** Announcement: public prediction-market leaderboard + weekly / monthly spotlight program. */
export async function sendLeaderboardSpotlightEmail(params: {
  to: string;
  name?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured" };

  const greeting = params.name ? `Hi ${params.name}` : "Hi there";
  const logoUrl = `${APP_URL}/brand/mark.svg`;
  const subject = "The Siren leaderboard is live";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Prediction leaderboard &amp; trader spotlight</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Rankings for Kalshi &amp; Polymarket-style trades only. Weekly and monthly top 3 get the spotlight. ${LEADERBOARD_URL.replace(/^https?:\/\//, "")}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#0f1411" style="background-color:#0f1411;">
    <tr>
      <td align="center" style="padding:28px 14px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#121a15" style="max-width:600px;border-radius:24px;overflow:hidden;border:1px solid #1f2e24;background-color:#121a15;">
          <tr>
            <td style="padding:0;border-top:4px solid #00c76a;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#0c1812" style="background-color:#0c1812;border-bottom:1px solid #1f2e24;">
                <tr>
                  <td style="padding:32px 28px 26px;">
                    <img src="${logoUrl}" alt="Siren" width="112" height="30" style="display:block;height:30px;width:auto;border:0;" />
                    <p style="margin:22px 0 0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#5ee9a8;font-weight:800;">
                      Leaderboard
                    </p>
                    <h1 style="margin:10px 0 0;font-size:30px;line-height:1.12;font-weight:800;letter-spacing:-0.03em;color:#f8fafc;">
                      Prediction traders, this scoreboard is yours.
                    </h1>
                    <p style="margin:18px 0 0;font-size:17px;line-height:1.65;color:#cbd5e1;">
                      ${greeting}, we just flipped on the <strong style="color:#f8fafc;">public leaderboard</strong> inside Siren. It ranks <strong style="color:#f8fafc;">wallets</strong> by how much prediction-market notional they push and how often their realized closes land green. Not random Solana mints outside prediction-market flows. If you have been trading Kalshi- and Polymarket-linked outcomes through the terminal, your volume finally has a place to flex.
                    </p>
                    <p style="margin:16px 0 0;font-size:17px;line-height:1.65;color:#cbd5e1;">
                      Open the board, pick <strong style="color:#f8fafc;">7 days</strong>, <strong style="color:#f8fafc;">30 days</strong>, or <strong style="color:#f8fafc;">all time</strong>, then toggle <strong style="color:#f8fafc;">sort by volume</strong> versus <strong style="color:#f8fafc;">sort by win rate</strong>. Same names, two stories: who is size, and who is sharp.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#052e1f" style="background-color:#052e1f;border:1px solid #0d5c3d;border-radius:18px;">
                <tr>
                  <td style="padding:22px 24px;">
                    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#5ee9a8;font-weight:800;">
                      Weekly &amp; monthly spotlight
                    </p>
                    <p style="margin:0;font-size:16px;line-height:1.65;color:#d1fae5;">
                      Every <strong style="color:#ecfdf5;">week</strong> and every <strong style="color:#ecfdf5;">month</strong>, we put the <strong style="color:#ecfdf5;">top three</strong> prediction traders on blast: featured on <a href="${X_URL}" style="color:#a7f3d0;font-weight:700;">X</a>, shout-outs in-product, and a rotating mix of <strong style="color:#ecfdf5;">rewards</strong> worth showing up for (think credits, merch, and partner drops. Full prize details post with each season on <a href="${X_URL}" style="color:#a7f3d0;font-weight:700;">@sirenmarketsxyz</a>).
                    </p>
                    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#86efac;">
                      No pay-to-win: ranks come from logged prediction-market trades only. Bring size, bring win rate, or bring both.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#1e293b" style="background-color:#1e293b;border:1px solid #334155;border-radius:18px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;font-weight:800;">
                      Before you scroll the feed
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:0 0 10px;font-size:15px;line-height:1.7;color:#e2e8f0;">
                          <span style="display:inline-block;min-width:22px;font-weight:800;color:#00c76a;">1.</span> Hit the leaderboard and sanity-check your window. Momentum traders love 7d, builders love 30d.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 10px;font-size:15px;line-height:1.7;color:#e2e8f0;">
                          <span style="display:inline-block;min-width:22px;font-weight:800;color:#00c76a;">2.</span> Log another prediction trade through Siren so your wallet does not ghost the rankings.
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;line-height:1.7;color:#e2e8f0;">
                          <span style="display:inline-block;min-width:22px;font-weight:800;color:#00c76a;">3.</span> Screenshot your spot, share the PnL card, and tag <a href="${X_URL}" style="color:#f8fafc;font-weight:700;">@sirenmarketsxyz</a>. We are watching for early legends.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 28px;" align="center">
              <a href="${LEADERBOARD_URL}" style="display:inline-block;background:#00c76a;color:#ffffff;font-size:17px;font-weight:800;text-align:center;text-decoration:none;padding:16px 32px;border-radius:14px;">
                View the leaderboard
              </a>
              <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#94a3b8;">
                Terminal: <a href="${APP_URL}" style="color:#e2e8f0;font-weight:600;">${APP_URL.replace(/^https?:\/\//, "")}</a>
                &nbsp;·&nbsp;
                Docs: <a href="${DOCS_URL}" style="color:#e2e8f0;font-weight:600;">docs.onsiren.xyz</a>
              </p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.55;color:#64748b;">
                Questions or press? Reply to this email. A human reads it.
              </p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#0a120e" style="padding:18px 28px 22px;border-top:1px solid #1f2e24;background-color:#0a120e;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#64748b;">
                You are receiving this because you joined the Siren waitlist or shared your email with us.
              </p>
              <p style="margin:0;font-size:12px;color:#475569;">
                (c) ${new Date().getFullYear()} Siren · onsiren.xyz
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = [
    subject,
    "",
    `${greeting},`,
    "The Siren leaderboard is live at " + LEADERBOARD_URL,
    "It ranks prediction-market traders (Kalshi / Polymarket-style trades through Siren) by notional volume and by win rate. Swaps that are not prediction-market activity are excluded.",
    "Every week and every month we spotlight the top three traders on X (@sirenmarketsxyz) with rewards and partner drops. Details post with each season.",
    "",
    `Open: ${APP_URL}`,
    `Docs: ${DOCS_URL}`,
  ].join("\n");

  return sendEmailWithRetry({
    to: params.to,
    subject,
    html,
    text,
  });
}
