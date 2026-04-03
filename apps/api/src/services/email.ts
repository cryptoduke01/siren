import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.SIREN_EMAIL_FROM || "Siren <onboarding@resend.dev>";
const APP_URL = (process.env.SIREN_APP_URL || "https://onsiren.xyz").replace(/\/+$/, "");
const DOCS_URL = "https://docs.onsiren.xyz";
const X_URL = "https://x.com/sirentracker";
const LAUNCH_THREAD_URL = "https://x.com/cryptoduke01/status/2037410069109768374";
const LAUNCH_THREAD_TITLE = "Prediction Markets, Memes, and The Madness";
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
                      You're among the first to access Siren - the event-driven meme token terminal on Solana. Use your one-time access code below to unlock the app.
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
                      <li>Connect your wallet or sign in with Google, GitHub, or X</li>
                      <li>Browse Kalshi prediction markets and trade meme tokens</li>
                    </ol>
                    <a href="${APP_URL}" style="display:inline-block;background:#22c55e;color:#0c0c0e;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                      Open Siren ->
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:36px;border-top:1px solid #1f1f24;margin-top:32px;">
                    <p style="margin:0 0 16px;font-size:13px;color:#71717a;">
                      <a href="${DOCS_URL}" style="color:#71717a;text-decoration:underline;">Docs</a> · <a href="${X_URL}" style="color:#71717a;text-decoration:underline;">X @sirentracker</a>
                    </p>
                    <p style="margin:0;font-size:12px;color:#52525b;">
                      (c) ${new Date().getFullYear()} Siren · Event-driven meme terminal
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
    "Enter your 6-digit code, connect your wallet or sign in, and start exploring event-driven meme tokens on Solana.",
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
                      We’re teeing up a thread contest for the waitlist next. Start warming up your takes, your memes, your charts, and your timeline game now.
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
                <a href="${DOCS_URL}" style="color:#475569;text-decoration:underline;">Docs</a> · <a href="${X_URL}" style="color:#475569;text-decoration:underline;">X @sirentracker</a>
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                (c) ${new Date().getFullYear()} Siren · Event-driven meme terminal
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

/** Product announcement: trading, deposits & withdrawals live — replaces legacy launch-thread blast for new campaigns. */
export async function sendTradingLiveAnnouncementEmail(params: {
  to: string;
  name?: string | null;
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
  <title>Siren is live — trade, fund, withdraw</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;color:#e8e8ec;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0f;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;border:1px solid #1f2420;border-radius:16px;background:#111318;overflow:hidden;">
          <tr>
            <td style="padding:0;border-top:3px solid #00ff85;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(180deg,#12151a 0%,#0e1014 100%);">
                <tr>
                  <td style="padding:36px 32px 28px;">
                    <img src="${logoUrl}" alt="Siren" width="112" height="30" style="display:block;height:30px;width:auto;" />
                    <p style="margin:28px 0 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#00ff85;font-weight:700;">
                      Now live
                    </p>
                    <h1 style="margin:12px 0 0;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:#f4f4f6;">
                      Prediction markets, deposits & withdrawals — all in one terminal.
                    </h1>
                    <p style="margin:18px 0 0;font-size:16px;line-height:1.65;color:#a1a1aa;">
                      ${greeting}, Siren is open for real: trade Kalshi and Polymarket-style events, surface meme tokens off the signal, and move money in and out without leaving the app.
                    </p>
                    <p style="margin:18px 0 0;font-size:16px;line-height:1.65;color:#a1a1aa;">
                      This is the moment to stress-test everything with us — push volume, try deposits and withdrawals, and put your opinions on-chain before the crowd catches up. Early movers help shape what we ship next.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 0;">
                      <tr>
                        <td style="background:#0c0f12;border:1px solid #252a32;border-radius:12px;padding:20px 22px;">
                          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#71717a;">What to try first</p>
                          <ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.7;color:#d4d4d8;">
                            <li>Open a position on a live prediction market</li>
                            <li>Fund your wallet (card or crypto) and withdraw when you are done</li>
                            <li>Share your PnL card — bragging rights encouraged</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 0;">
                      <tr>
                        <td align="center">
                          <a href="${APP_URL}" style="display:inline-block;background:#00ff85;color:#050508;font-size:16px;font-weight:800;text-decoration:none;padding:16px 36px;border-radius:12px;letter-spacing:0.02em;">
                            Open Siren
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717a;">
                      Questions? Reply to this email or find us on <a href="${X_URL}" style="color:#00ff85;text-decoration:none;">X</a>. Docs live at <a href="${DOCS_URL}" style="color:#00ff85;text-decoration:none;">docs.onsiren.xyz</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #1f2420;">
              <p style="margin:0;font-size:12px;color:#52525b;">
                You are receiving this because you joined the Siren waitlist or shared your email with us.
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
    "Siren is live: prediction market trading, deposits, and withdrawals are available in one terminal.",
    "Trade events, fund your wallet, withdraw when you are done — and help us break volume while rewards for sharp takes are on the roadmap.",
    `Open the app: ${APP_URL}`,
    `Docs: ${DOCS_URL}`,
  ].join("\n\n");

  return sendEmailWithRetry({
    to: params.to,
    subject: "Siren: prediction trading, deposits & withdrawals are live",
    html,
    text,
  });
}
