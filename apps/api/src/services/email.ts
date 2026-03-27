import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.SIREN_EMAIL_FROM || "Siren <onboarding@resend.dev>";
const APP_URL = process.env.SIREN_APP_URL || "https://onsiren.xyz";
const DOCS_URL = "https://docs.onsiren.xyz";
const X_URL = "https://x.com/sirentracker";
const LAUNCH_THREAD_URL = "https://x.com/cryptoduke01/status/2037410069109768374";
const LAUNCH_THREAD_TITLE = "Prediction Markets, Memes, and The Madness";
const LAUNCH_THREAD_PREVIEW =
  "There is a particular kind of suffering that belongs only to the man who sees what is coming and cannot make anyone believe him.";
const LAUNCH_THREAD_IMAGE_URL = `${APP_URL}/emails/launch-thread-cover.jpg`;

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

  const { error } = await resend.emails.send({
    from: FROM,
    to: [params.to],
    subject: "Your Siren access code - you're in",
    html,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendLaunchThreadEmail(params: {
  to: string;
  name?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured" };

  const greeting = params.name ? `Hi ${params.name}` : "Hi there";
  const logoUrl = `${APP_URL}/brand/logo.svg`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The official Siren launch thread is live</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#eef3ff;color:#10131a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    The official Siren launch thread is out. Read it, show it love on X, and get ready for the thread contest coming soon.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:
    radial-gradient(circle at top left, rgba(0,255,133,0.16), transparent 34%),
    radial-gradient(circle at top right, rgba(90,169,255,0.18), transparent 28%),
    linear-gradient(180deg, #f7fbff 0%, #eef3ff 100%);
  ">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;border:1px solid #d6deef;border-radius:28px;background:#ffffff;box-shadow:0 24px 72px rgba(15,23,42,0.16);overflow:hidden;">
          <tr>
            <td style="padding:0;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:
                radial-gradient(circle at top left, rgba(0,255,133,0.32), transparent 32%),
                radial-gradient(circle at top right, rgba(106,92,255,0.16), transparent 28%),
                linear-gradient(135deg, #081019 0%, #0f1f2d 52%, #11263f 100%);
                border-bottom:1px solid rgba(255,255,255,0.08);
              ">
                <tr>
                  <td style="padding:28px 28px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-bottom:22px;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:10px 14px;">
                                <img src="${logoUrl}" alt="Siren" width="120" height="34" style="display:block;height:28px;width:auto;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0 0 12px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#7fffd0;">
                            Official Launch Thread
                          </p>
                          <h1 style="margin:0 0 14px;font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-0.03em;color:#f6f8ff;">
                            Siren is live on the timeline.
                          </h1>
                          <p style="margin:0;font-size:16px;line-height:1.7;color:#c4d2ea;max-width:500px;">
                            ${greeting}, the official Siren launch thread is out. It tells the story, sets the tone, and gives people their first real feel for what we’re building.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:22px;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-right:10px;padding-bottom:10px;">
                                <a href="${LAUNCH_THREAD_URL}" style="display:inline-block;background:#00ff85;color:#061018;font-size:14px;font-weight:800;text-decoration:none;padding:14px 20px;border-radius:999px;">
                                  Read the thread
                                </a>
                              </td>
                              <td style="padding-bottom:10px;">
                                <a href="${APP_URL}" style="display:inline-block;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.16);color:#f6f8ff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 20px;border-radius:999px;">
                                  Open Siren
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;">
                <tr>
                  <td style="border:1px solid #d9e4f5;border-radius:22px;overflow:hidden;background:#f8fbff;">
                    <img src="${LAUNCH_THREAD_IMAGE_URL}" alt="${LAUNCH_THREAD_TITLE}" width="564" height="226" style="display:block;width:100%;height:auto;" />
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:18px 20px 20px;">
                          <p style="margin:0 0 8px;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#1573ff;">
                            Launch Story
                          </p>
                          <h2 style="margin:0 0 8px;font-size:24px;line-height:1.15;font-weight:800;color:#0f172a;">
                            ${LAUNCH_THREAD_TITLE}
                          </h2>
                          <p style="margin:0;font-size:15px;line-height:1.7;color:#4b5565;">
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
                  <td style="background:linear-gradient(135deg, #ebfffa 0%, #f3f7ff 54%, #fff3f7 100%);border:1px solid #d8e8ff;border-radius:22px;padding:20px;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#0f172a;">
                      What We Need From You
                    </p>
                    <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">
                      Help us put real wind behind it. If you’re on the waitlist, this is the moment to push the story out a little further.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:0 0 10px;">
                          <span style="display:inline-block;background:#ffffff;border:1px solid #cfe0ff;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:700;color:#0f172a;">Like it</span>
                          <span style="display:inline-block;background:#ffffff;border:1px solid #cfe0ff;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:700;color:#0f172a;margin-left:8px;">Retweet it</span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span style="display:inline-block;background:#ffffff;border:1px solid #cfe0ff;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:700;color:#0f172a;">Comment on it</span>
                          <span style="display:inline-block;background:#ffffff;border:1px solid #cfe0ff;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:700;color:#0f172a;margin-left:8px;">Share it with friends</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;">
                <tr>
                  <td style="background:#0e1726;border-radius:22px;padding:20px;border:1px solid #1f3250;">
                    <p style="margin:0 0 8px;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#7fffd0;">
                      Thread Contest Coming Soon
                    </p>
                    <p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:#dbeafe;">
                      We’re teeing up a thread contest for the waitlist next. Start warming up your takes, your memes, your charts, and your timeline game now.
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#9fb5d1;">
                      More details soon. For now, gear up and stay close.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;padding-bottom:10px;">
                    <a href="${LAUNCH_THREAD_URL}" style="display:inline-block;background:#0f172a;color:#f8fafc;font-size:14px;font-weight:800;text-decoration:none;padding:14px 20px;border-radius:999px;">
                      Open the thread
                    </a>
                  </td>
                  <td style="padding-bottom:10px;">
                    <a href="https://twitter.com/intent/tweet?text=The%20official%20Siren%20launch%20thread%20is%20live.%20Prediction%20Markets%2C%20Memes%2C%20and%20The%20Madness.&url=${encodeURIComponent(LAUNCH_THREAD_URL)}" style="display:inline-block;background:#ffffff;color:#0f172a;font-size:14px;font-weight:700;text-decoration:none;padding:14px 20px;border-radius:999px;border:1px solid #d6deef;">
                      Quote or share it
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
            <td style="padding:18px 28px 24px;border-top:1px solid #e5edf8;background:#fbfdff;">
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

  const { error } = await resend.emails.send({
    from: FROM,
    to: [params.to],
    subject: "The official Siren launch thread is live",
    html,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
