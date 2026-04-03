import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.SIREN_EMAIL_FROM || "Siren <onboarding@resend.dev>";
const APP_URL = process.env.SIREN_APP_URL || "https://onsiren.xyz";
const DOCS_URL = "https://docs.onsiren.xyz";
const X_URL = "https://x.com/sirentracker";

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

export async function sendVolumeCompetitionEmail(params: {
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
  <title>Siren Volume Sprint</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b0b10;color:#e5e5f0;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0b10;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;border:1px solid #20202a;border-radius:14px;background:#111119;">
          <tr>
            <td style="padding:24px 22px 20px;border-bottom:1px solid #20202a;">
              <img src="${logoUrl}" alt="Siren" width="120" height="32" style="display:block;height:28px;width:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:24px 22px 28px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:650;color:#fafafc;">Siren Volume Sprint is live</h1>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#b4b4c8;">
                ${greeting},
              </p>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#b4b4c8;">
                We’ve been heads down wiring swaps, portfolio PnL, Bags fee claiming, and surfaced tokens around real-world events - and we’re finally ready to start inviting more traders back in.
              </p>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#b4b4c8;">
                Now’s a great time to jump back in, try the terminal, and help us shake out the edges. Connect your wallet, trade a few tokens, and tell us what feels good (or rough).
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#b4b4c8;">
                We’re also kicking off a low‑key volume competition for early users. We’ll share full details (prizes, dates, and rules) publicly soon - for now, just know that early trading volume will count.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">
                <tr>
                  <td style="background:#141421;border-radius:10px;padding:14px 16px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#e5e5f0;">Rough sketch</p>
                    <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#a1a1b5;">
                      <li>Trade any token surfaced in the Siren terminal</li>
                      <li>Volume is tracked per wallet in SOL (and ≈USD) on Siren</li>
                      <li>We’ll publish the exact leaderboard + prize breakdown in the coming days</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <a href="${APP_URL}" style="display:inline-block;background:#22c55e;color:#050509;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:999px;margin:0 0 12px;">
                Open Siren ->
              </a>
              <p style="margin:8px 0 0;font-size:12px;color:#717189;">
                You’re receiving this because you joined the Siren waitlist or connected a wallet.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 22px 20px;border-top:1px solid #20202a;">
              <p style="margin:0 0 6px;font-size:11px;color:#77778f;">
                <a href="${DOCS_URL}" style="color:#77778f;text-decoration:underline;">Docs</a> · <a href="${X_URL}" style="color:#77778f;text-decoration:underline;">X @sirentracker</a>
              </p>
              <p style="margin:0;font-size:11px;color:#55556a;">
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
    subject: "Siren Volume Sprint - trade to climb the board",
    html,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
