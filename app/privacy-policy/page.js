import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import styles from "./page.module.css";

export const metadata = {
  title: "Privacy Policy — Dhalahore Properties",
  description:
    "How Dhalahore Properties collects, uses, and protects personal information for buyers, renters, and real estate agents in Lahore.",
};

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Find agents", href: "/#agents" },
  { label: "Why us", href: "/#why-us" },
  { label: "Contact", href: "/#contact" },
];

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.page}>
      <SiteHeader navLinks={NAV_LINKS} />

      <main className={styles.main}>
        <article className={styles.article}>
          <p className={styles.kicker}>Legal</p>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.updated}>Last updated: 11 August 2026</p>
          <p className={styles.lead}>
            Dhalahore Properties (“we”, “us”, or “our”) is a Lahore-focused
            platform that helps people find verified real estate agents and
            helps approved agents publish branded listing websites. This policy
            explains what information we collect, why we collect it, and how we
            protect it.
          </p>

          <section className={styles.section}>
            <h2>1. Who this policy covers</h2>
            <p>This policy applies when you:</p>
            <ul>
              <li>Browse our homepage to discover Lahore estate agents</li>
              <li>Visit an agent’s public website or property listing</li>
              <li>Send an inquiry, call, or WhatsApp message through the site</li>
              <li>Apply to become an agent, or use an agent or admin account</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>2. Information we collect</h2>
            <h3>Visitors and property seekers</h3>
            <p>Depending on how you use the site, we may collect:</p>
            <ul>
              <li>Name, phone number, email address, and message content from inquiry or contact forms</li>
              <li>The property or agent page you were viewing when you reached out</li>
              <li>Search terms and filters you use to find agents or listings</li>
              <li>Basic technical data such as browser type, device, and pages visited</li>
            </ul>
            <h3>Real estate agents</h3>
            <p>If you register or operate an agent account, we may also collect:</p>
            <ul>
              <li>Full name, estate or agency name, email, phone number, licence number, and signup message</li>
              <li>Login credentials and session information</li>
              <li>Profile photo, company logo, company name, description, and areas served</li>
              <li>Property listings you publish, including photos, walkthrough videos, prices, locations, and descriptions</li>
            </ul>
            <h3>Administrators</h3>
            <p>
              Superadmin accounts are used only to review agent requests, approve
              or reject listings, and keep the platform secure. We keep audit
              records of those actions.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. How we use your information</h2>
            <ul>
              <li>Show verified agent profiles and property listings</li>
              <li>Deliver your inquiry to the relevant agent so they can contact you</li>
              <li>Review and approve new agent applications</li>
              <li>Let approved agents manage their public website, branding, and listings</li>
              <li>Improve search, listing quality, and site reliability</li>
              <li>Prevent fraud, abuse, and unauthorized access</li>
              <li>Respond to support requests and legal obligations</li>
            </ul>
            <p>
              We do not sell your personal information to third-party marketers.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. When we share information</h2>
            <ul>
              <li>
                <strong>With agents.</strong> If you submit an inquiry on an
                agent’s page or listing, that agent receives the details you
                provided so they can follow up about the property.
              </li>
              <li>
                <strong>With WhatsApp or your phone carrier.</strong> If you
                choose WhatsApp or a phone link, that conversation happens on
                those services under their own terms.
              </li>
              <li>
                <strong>With service providers.</strong> We may use hosting,
                email, and authentication services that process data only to
                operate this website.
              </li>
              <li>
                <strong>When required by law.</strong> We may disclose
                information if we believe it is necessary to comply with
                applicable law or protect users, agents, or the platform.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>5. Cookies and account sessions</h2>
            <p>
              We use essential cookies and similar technologies to keep you
              signed in, protect accounts, and remember basic site preferences.
              These are needed for agent and admin dashboards to work. We do
              not use them to build advertising profiles.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Property photos and videos</h2>
            <p>
              Agents upload listing images and walkthrough videos to show
              properties to the public. Those files appear on the agent’s
              website and related listing pages. Agents should only upload
              media they have the right to use and should avoid including
              unnecessary personal details of occupants or third parties.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. How long we keep information</h2>
            <p>
              We keep personal information only as long as needed for the
              purposes above. Inquiry records are retained so agents and our
              team can follow up and resolve issues. Agent account and listing
              data is kept while the account is active and for a reasonable
              period after closure or rejection, unless a longer period is
              required by law.
            </p>
          </section>

          <section className={styles.section}>
            <h2>8. How we protect information</h2>
            <p>
              We use access controls, authenticated dashboards, and careful
              handling of uploaded files to protect personal and listing data.
              No website can guarantee absolute security, so please avoid
              sending sensitive financial documents through public inquiry
              forms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Your choices</h2>
            <ul>
              <li>You may browse public agent pages without creating an account.</li>
              <li>You can choose not to submit an inquiry form.</li>
              <li>Agents can update or remove profile, branding, and listing information from their dashboard.</li>
              <li>
                To correct or delete inquiry details you sent us, email{" "}
                <a href="mailto:info@dhalahore.com">info@dhalahore.com</a>.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>10. Children</h2>
            <p>
              This website is intended for adults looking to buy, rent, or list
              property, and for licensed or professional real estate agents. We
              do not knowingly collect personal information from children.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The “Last
              updated” date at the top will change when we do. Continued use of
              the site after an update means you accept the revised policy.
            </p>
          </section>

          <section className={styles.section}>
            <h2>12. Contact us</h2>
            <p>
              If you have questions about this policy or your information,
              contact Dhalahore Properties:
            </p>
            <ul>
              <li>
                Email:{" "}
                <a href="mailto:info@dhalahore.com">info@dhalahore.com</a>
              </li>
              <li>
                Phone:{" "}
                <a href="tel:+923001234567">+92 300 123 4567</a>
              </li>
              <li>Office: 12 Garden Town, Lahore</li>
            </ul>
          </section>

          <p className={styles.backRow}>
            <Link href="/" className={styles.backLink}>
              Back to home
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
