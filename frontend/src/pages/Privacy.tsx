export function Privacy() {
  return (
    <article>
      <h1 className="h3 mb-3">Privacy policy</h1>
      <p>This policy template explains how data is handled in this project deployment. Replace with counsel-approved legal text before production use.</p>

      <h2 className="h5 mt-4">Data controller and contact</h2>
      <p className="mb-2">Data controller: Light on a Hill Foundation (course project implementation).</p>
      <p className="mb-0">Contact for privacy requests: support@lightonahill.org</p>

      <h2 className="h5 mt-4">What data we process</h2>
      <ul>
        <li>Account data: email, login credentials (hashed), role assignments.</li>
        <li>Donor data: supporter profile fields, donation records, contribution metadata.</li>
        <li>Case management data: resident, process, visitation, intervention, and related records entered by authorized staff users.</li>
        <li>Technical data: basic request logs and audit entries for security and accountability.</li>
      </ul>

      <h2 className="h5 mt-4">Lawful basis and purpose</h2>
      <ul>
        <li>Service operation: authentication, authorization, and secure administration.</li>
        <li>Program delivery: donor tracking and social service case management workflows.</li>
        <li>Legitimate interest: quality, fraud prevention, incident response, and system auditing.</li>
      </ul>

      <h2 className="h5 mt-4">Cookies and consent</h2>
      <ul>
        <li>Essential cookies are used for session/authentication behavior.</li>
        <li>Optional preference storage (for example, theme) is used only after consent.</li>
        <li>You can accept or reject optional cookies from the cookie banner.</li>
      </ul>

      <h2 className="h5 mt-4">Retention and storage</h2>
      <ul>
        <li>Data retention follows institutional policy and project configuration.</li>
        <li>Records are stored in project databases and logs configured for this environment.</li>
        <li>Retention periods should be finalized by policy owners before production rollout.</li>
      </ul>

      <h2 className="h5 mt-4">User rights</h2>
      <ul>
        <li>Request access to personal data stored about you.</li>
        <li>Request correction of inaccurate records.</li>
        <li>Request deletion or restriction where legally applicable.</li>
        <li>Request export/portability of your donor/account data where feasible.</li>
      </ul>

      <h2 className="h5 mt-4">Security and processors</h2>
      <p>
        Access is role-gated, sensitive operations are logged, and transport/storage protections are applied according to deployment settings. Third-party infrastructure providers
        (for hosting/database) act as processors under their platform terms.
      </p>

      <h2 className="h5 mt-4">Policy updates</h2>
      <p className="mb-0">This policy may change as the platform evolves. Material changes should be communicated through the website and project documentation.</p>
    </article>
  )
}
