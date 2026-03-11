export default function PrivacyPage() {
  const effectiveDate = "March 11, 2026";
  return (
    <>
      <h1>Privacy Policy</h1>
      <p><em>Effective date: {effectiveDate}</em></p>
      <p>
        This Privacy Policy explains how Siren (“we”, “us”) collects, uses, and shares information when you use the Service.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>Account and login info from your wallet or OAuth provider (e.g. Google, GitHub, X).</li>
        <li>Waitlist info such as email, name, and optional wallet address.</li>
        <li>Usage diagnostics (e.g. timestamps, pages viewed) and coarse location signals for compliance and abuse prevention.</li>
        <li>Public blockchain data associated with wallets you use with Siren.</li>
      </ul>
      <h2>How we use information</h2>
      <ul>
        <li>Provide and secure the Service, including access gating and fraud prevention.</li>
        <li>Send onboarding and access-code emails when requested.</li>
        <li>Operate features that depend on third-party APIs (market data, quotes, swaps).</li>
        <li>Comply with legal and regulatory requirements.</li>
      </ul>
      <h2>How we share information</h2>
      <p>
        We share information with service providers that help us run Siren, such as authentication, email, infrastructure, and
        market data partners. These providers process information under their own terms and policies. We do not sell your personal
        information.
      </p>
      <h2>Data retention</h2>
      <p>We keep information only as long as necessary to operate the Service and meet legal obligations.</p>
      <h2>Security</h2>
      <p>We use reasonable safeguards to protect information, but no system is perfectly secure.</p>
      <h2>Changes</h2>
      <p>We may update this policy from time to time. Continued use after updates become effective indicates acceptance.</p>
    </>
  );
}

