import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.SIREN_EMAIL_FROM || "Siren <onboarding@resend.dev>";
const APP_URL = process.env.SIREN_APP_URL || "https://onsiren.xyz";

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
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0c;color:#e4e4e7;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-size:24px;font-weight:700;margin:0 0 24px;color:#fafafa;">You're in — welcome to Siren</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#a1a1aa;">
      ${greeting},
    </p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#a1a1aa;">
      You're among the first to access Siren — the event-driven meme token terminal. Use your access code below to unlock the app.
    </p>
    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin:0 0 24px;text-align:center;">
      <p style="font-size:12px;margin:0 0 8px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em;">Your access code</p>
      <p style="font-size:28px;font-weight:600;margin:0;font-family:monospace;letter-spacing:0.25em;color:#fafafa;">${params.code}</p>
    </div>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#a1a1aa;">
      <strong style="color:#fafafa;">How to get started:</strong>
    </p>
    <ol style="font-size:15px;line-height:1.7;margin:0 0 24px;padding-left:20px;color:#a1a1aa;">
      <li>Go to <a href="${APP_URL}" style="color:#a78bfa;">onsiren.xyz</a></li>
      <li>Enter your 6-digit access code when prompted</li>
      <li>Connect your wallet (Phantom, Solflare, or Torus) or sign in with Google / GitHub / X</li>
      <li>Browse Kalshi prediction markets and surface tokens tied to real-world events</li>
      <li>Trade markets and meme tokens from one terminal</li>
    </ol>
    <a href="${APP_URL}" style="display:inline-block;background:#a78bfa;color:#0a0a0c;font-size:15px;font-weight:600;text-decoration:none;padding:14px 24px;border-radius:10px;margin:0 0 24px;">
      Open Siren →
    </a>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#71717a;">
      Questions? Reply to this email.
    </p>
  </div>
</body>
</html>
`.trim();

  const { error } = await resend.emails.send({
    from: FROM,
    to: [params.to],
    subject: "Your Siren access code — you're in",
    html,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
