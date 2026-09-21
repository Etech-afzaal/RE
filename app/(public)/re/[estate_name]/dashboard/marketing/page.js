"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";

const TIP_LIST = [
  "Upload high-quality images",
  "Write clear, accurate titles",
  "Add a detailed description",
  "Add property highlights",
  "Add accurate location details",
  "Keep information updated",
];

const BLOG_EXAMPLES = [
  { label: "Top 5 reasons to buy in DHA", hint: "Area-focused market insight" },
  { label: "Investment guide for Lahore", hint: "Buyer education content" },
  { label: "How to verify property documents", hint: "Trust-building guide" },
];

const VIDEO_IDEAS = [
  "Property walkthrough videos",
  "Area and neighbourhood guides",
  "Market updates and price trends",
  "Q&A clips answering buyer questions",
];

const SHARE_CHANNELS = [
  { label: "WhatsApp", color: "#25d366" },
  { label: "Facebook", color: "#1877f2" },
  { label: "Instagram", color: "#e4405f" },
  { label: "Direct clients", color: "#c9961f" },
];

const SOCIAL_PLATFORMS = [
  { label: "Facebook", color: "#1877f2" },
  { label: "Instagram", color: "#e4405f" },
  { label: "LinkedIn", color: "#0a66c2" },
  { label: "WhatsApp", color: "#25d366" },
];

const RESOURCES = [
  {
    name: "Google Business Profile",
    desc: "Manage your agency's local listing",
    href: "https://www.google.com/business/",
  },
  {
    name: "Google Search Console",
    desc: "Monitor how Google sees your site",
    href: "https://search.google.com/search-console",
  },
  {
    name: "Bing Webmaster Tools",
    desc: "Submit and monitor pages on Bing",
    href: "https://www.bing.com/webmasters",
  },
  {
    name: "Canva",
    desc: "Create property images and graphics",
    href: "https://www.canva.com/",
  },
  {
    name: "Meta Business Suite",
    desc: "Manage Facebook & Instagram pages",
    href: "https://business.facebook.com/",
  },
  {
    name: "Google Analytics",
    desc: "Understand your website visitors",
    href: "https://analytics.google.com/",
  },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12.5 10 17.5 19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.8 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.8-3.8-9s1.3-6.5 3.8-9Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ListingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 9h8M8 12.5h8M8 16h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BlogIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h9a3 3 0 0 1 3 3v13H7a2 2 0 0 1-2-2V4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 8h5M8 11.5h5M8 15h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="6" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.2 10.8 15.8 7.2M8.2 13.2 15.8 16.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SeoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16 21 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SocialIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 4v5a2 2 0 0 1-2 2h-3l3 7-3.5-1L9 11 4 9.5 4 4h14Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.5 10.5 10 13l5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 17l2 2 3-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResourceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5 17h14" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function AgentMarketingPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/dashboard`;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name || "Agent"}
        title="Marketing Academy"
        subtitle="Grow your real estate business"
      >
        <div className={styles.hero}>
          <p className={styles.heroKicker}>Marketing Academy</p>
          <h1 className={styles.heroTitle}>Loading…</h1>
        </div>
      </AgentPortalShell>
    );
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Marketing Academy"
      subtitle="Learn how to market properties, attract buyers, and build your online presence"
    >
      <div className={styles.page}>
        {/* Hero */}
        <section className={styles.hero}>
          <p className={styles.heroKicker}>Agent Marketing Academy</p>
          <h1 className={styles.heroTitle}>Grow Your Real Estate Business</h1>
          <p className={styles.heroSubtitle}>
            Learn how to market properties, attract buyers, and build your online
            presence using our platform.
          </p>
          <div className={styles.heroPills}>
            <span className={styles.heroPill}>
              <ArrowIcon /> Marketing Tips
            </span>
            <span className={styles.heroPill}>
              <ArrowIcon /> Property Promotion
            </span>
            <span className={styles.heroPill}>
              <ArrowIcon /> Digital Growth
            </span>
          </div>
        </section>

        {/* Section 1 — Digital Office */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><WebsiteIcon /></span>
            <h2 className={styles.sectionTitle}>Your Website Is Your Digital Office</h2>
          </div>
          <p className={styles.sectionLead}>
            Every agent gets a professional public website where customers can
            view properties, contact you, explore your company profile, read
            your blogs, and watch your videos — all in one place.
          </p>
          <div className={styles.tipGrid}>
            {[
              "Keep your profile photo and company logo updated",
              "Fill in your office address and contact details",
              "Add a clear company description and areas served",
              "A complete profile builds buyer trust",
            ].map((tip) => (
              <div key={tip} className={styles.tipCard}>
                <span className={styles.tipCheck}><CheckIcon /></span>
                <span className={styles.tipBody}>{tip}</span>
              </div>
            ))}
          </div>
          <div className={styles.highlight}>
            <strong>Tip:</strong> Keep your profile updated in{" "}
            <Link href={`${base}/profile`} className={styles.extLink}>My Profile</Link>{" "}
            and <Link href={`${base}/company-branding`} className={styles.extLink}>Company Branding</Link>.
          </div>
        </section>

        {/* Section 2 — Property Marketing */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><ListingIcon /></span>
            <h2 className={styles.sectionTitle}>Property Marketing</h2>
          </div>
          <p className={styles.sectionLead}>
            Better listings attract more buyers. Follow these tips when creating
            a property:
          </p>
          <div className={styles.tipGrid}>
            {TIP_LIST.map((tip) => (
              <div key={tip} className={styles.tipCard}>
                <span className={styles.tipCheck}><CheckIcon /></span>
                <span className={styles.tipBody}>{tip}</span>
              </div>
            ))}
          </div>
          <div className={styles.highlight}>
            <strong>Start now:</strong>{" "}
            <Link href={`${base}/properties/create`} className={styles.extLink}>Add a new property</Link>{" "}
            or <Link href={`${base}/properties`} className={styles.extLink}>edit existing listings</Link>.
          </div>
        </section>

        {/* Section 3 — Blogs */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><BlogIcon /></span>
            <h2 className={styles.sectionTitle}>Use Blogs To Build Authority</h2>
          </div>
          <p className={styles.sectionLead}>
            Agents can publish blog articles to share market knowledge, explain
            areas, guide buyers, and build trust — published blogs appear on
            your public website.
          </p>
          <p className={styles.tipBody}><strong>Write about things buyers search for:</strong></p>
          <div className={styles.exampleGrid}>
            {BLOG_EXAMPLES.map((ex) => (
              <div key={ex.label} className={styles.exampleCard}>
                <p className={styles.exampleLabel}>{ex.label}</p>
                <p className={styles.exampleHint}>{ex.hint}</p>
              </div>
            ))}
          </div>
          <div className={styles.highlight}>
            <strong>Get started:</strong>{" "}
            <Link href={`${base}/blogs/create`} className={styles.extLink}>Write your first blog</Link>.
          </div>
        </section>

        {/* Section 4 — Video Posts */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><VideoIcon /></span>
            <h2 className={styles.sectionTitle}>Use Video Posts</h2>
          </div>
          <p className={styles.sectionLead}>
            Videos help you showcase properties, give virtual tours, and build
            customer confidence — especially for buyers who cannot visit in person.
          </p>
          <div className={styles.tipGrid}>
            {VIDEO_IDEAS.map((idea) => (
              <div key={idea} className={styles.tipCard}>
                <span className={styles.tipCheck}><CheckIcon /></span>
                <span className={styles.tipBody}>{idea}</span>
              </div>
            ))}
          </div>
          <div className={styles.highlight}>
            <strong>Upload now:</strong>{" "}
            <Link href={`${base}/video-posts/create`} className={styles.extLink}>Add a video post</Link>.
          </div>
        </section>

        {/* Section 5 — Share Links */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><ShareIcon /></span>
            <h2 className={styles.sectionTitle}>Share Your Property Links</h2>
          </div>
          <p className={styles.sectionLead}>
            Every property has a shareable public link. You can also create
            subagent marketing links to track where your leads come from.
          </p>
          <p className={styles.tipBody}><strong>Share your links on:</strong></p>
          <div className={styles.platformGrid}>
            {SHARE_CHANNELS.map((ch) => (
              <div key={ch.label} className={styles.platformCard}>
                <span className={styles.platformDot} style={{ background: ch.color }} />
                {ch.label}
              </div>
            ))}
          </div>
          <div className={styles.highlight}>
            <strong>Tracking benefit:</strong> Subagent marketing links let you
            see which channel drives the most inquiries.{" "}
            <Link href={`${base}/subagents`} className={styles.extLink}>Manage subagents</Link>.
          </div>
        </section>

        {/* Section 6 — SEO */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><SeoIcon /></span>
            <h2 className={styles.sectionTitle}>Search Engine Visibility (SEO)</h2>
          </div>
          <p className={styles.sectionLead}>
            Search engines like Google and Bing discover your properties automatically.
            You can help them by keeping listings complete, adding descriptions, and
            publishing useful content. Here are tools to understand and improve
            your visibility:
          </p>
          <div className={styles.tipGrid}>
            {[
              "Keep every listing complete with description and location",
              "Publish helpful blogs and videos regularly",
              "Share your public links on social media",
              "Add your website to Google Business Profile",
            ].map((tip) => (
              <div key={tip} className={styles.tipCard}>
                <span className={styles.tipCheck}><CheckIcon /></span>
                <span className={styles.tipBody}>{tip}</span>
              </div>
            ))}
          </div>
          <div className={styles.highlight}>
            Useful:{" "}
            <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className={styles.extLink}>Google Search Console</a>,{" "}
            <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer" className={styles.extLink}>Bing Webmaster Tools</a>,{" "}
            <a href="https://www.google.com/business/" target="_blank" rel="noopener noreferrer" className={styles.extLink}>Google Business Profile</a>.
          </div>
        </section>

        {/* Section 7 — Social Media */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><SocialIcon /></span>
            <h2 className={styles.sectionTitle}>Social Media Marketing</h2>
          </div>
          <p className={styles.sectionLead}>
            Social media extends your reach beyond your website. Share your
            property images, video tours, and blog articles — and respond to
            inquiries quickly.
          </p>
          <div className={styles.platformGrid}>
            {SOCIAL_PLATFORMS.map((p) => (
              <div key={p.label} className={styles.platformCard}>
                <span className={styles.platformDot} style={{ background: p.color }} />
                {p.label}
              </div>
            ))}
          </div>
          <div className={styles.tipGrid} style={{ marginTop: "0.85rem" }}>
            {[
              "Share property images and video tours",
              "Share links to your blog articles",
              "Respond to messages and inquiries quickly",
              "Post consistently to stay visible",
            ].map((tip) => (
              <div key={tip} className={styles.tipCard}>
                <span className={styles.tipCheck}><CheckIcon /></span>
                <span className={styles.tipBody}>{tip}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 8 — Checklist */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><ChecklistIcon /></span>
            <h2 className={styles.sectionTitle}>Marketing Checklist</h2>
          </div>
          <div className={styles.checklist}>
            <div className={styles.checklistBlock}>
              <p className={styles.checklistTitle}>Before publishing a property</p>
              <div className={styles.checklistItems}>
                {[
                  "Good images uploaded",
                  "Correct location added",
                  "Complete description written",
                  "Highlights added",
                  "Share link ready",
                ].map((item) => (
                  <div key={item} className={styles.checklistItem}>
                    <CheckIcon /> {item}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.checklistBlock}>
              <p className={styles.checklistTitle}>After publishing</p>
              <div className={styles.checklistItems}>
                {[
                  "Share with clients on WhatsApp",
                  "Post on social media",
                  "Follow up on inquiries",
                  "Monitor property views",
                ].map((item) => (
                  <div key={item} className={styles.checklistItem}>
                    <CheckIcon /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 9 — Resources */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><ResourceIcon /></span>
            <h2 className={styles.sectionTitle}>Helpful Resources</h2>
          </div>
          <p className={styles.sectionLead}>
            Free tools to help you market your properties and manage your online
            presence. Links open in a new tab.
          </p>
          <div className={styles.resourceGrid}>
            {RESOURCES.map((r) => (
              <a
                key={r.name}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.resourceCard}
              >
                <span className={styles.resourceMeta}>
                  <span className={styles.resourceName}>{r.name}</span>
                  <span className={styles.resourceDesc}>{r.desc}</span>
                </span>
                <span className={styles.resourceArrow}><ArrowIcon /></span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </AgentPortalShell>
  );
}
