"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Check, Clock3, Contact, GalleryHorizontalEnd, Globe2, House, Images, LayoutDashboard, MessageCircle, Play, ShieldCheck } from "lucide-react";
import styles from "./AgentMarketingPage.module.css";

const BENEFITS = [
  [Globe2, "Get discovered", "Help potential buyers find you and your listings."],
  [ShieldCheck, "Build credibility", "Present your experience and agency professionally."],
  [House, "Showcase properties", "Give every approved listing a polished public page."],
  [MessageCircle, "Make contact easy", "Give interested buyers a direct way to reach you."],
  [Clock3, "Stay visible online", "Keep your business and listings available around the clock."],
];

const FEATURES = [
  [Contact, "Professional Agent Profile", "A dedicated public profile for you and your agency."],
  [Globe2, "Public Agent Website", "A shareable online home for your real estate business."],
  [Building2, "Property Listings", "Add and manage properties from your dashboard."],
  [GalleryHorizontalEnd, "Detailed Property Pages", "Present important property information and highlights."],
  [Images, "Property Image Gallery", "Display multiple property images professionally."],
  [Play, "Property Video Tours", "Show supported videos on public property pages."],
  [BadgeCheck, "Company Branding", "Present your agency branding across your public presence."],
  [MessageCircle, "Direct Buyer Contact", "Receive inquiries through the existing contact tools."],
  [LayoutDashboard, "Agent Dashboard", "Manage your profile, branding, and properties in one place."],
  [Check, "Property Approval Workflow", "Submit properties for approval before publication."],
];

export default function AgentMarketingPage() {
  const [accepted, setAccepted] = useState(false);

  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <div className={styles.scrollContent}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>Become a Dhalahore Agent</p>
            <h1>Build Your Professional Real Estate Presence — Completely Free</h1>
            <p className={styles.lead}>Dhalahore gives you a professional online presence where you can showcase your business and properties and be discovered by buyers.</p>
          </header>

          <section className={styles.block} aria-labelledby="benefits-heading">
          <div className={styles.blockHeading}>
            <p className={styles.stepLabel}>Why it matters</p>
            <h2 id="benefits-heading">Why Your Real Estate Business Needs an Online Presence</h2>
          </div>
          <div className={styles.benefitGrid}>
            {BENEFITS.map(([Icon, title, copy]) => (
              <div className={styles.benefitItem} key={title}>
                <span className={styles.iconBox}><Icon size={20} aria-hidden="true" /></span>
                <div><h3>{title}</h3><p>{copy}</p></div>
              </div>
            ))}
          </div>
          </section>

          <aside className={styles.freePanel}>
          <span className={styles.freeBadge}>100% Free</span>
          <div>
            <h2>Everything You Need. Completely Free.</h2>
            <p>Create your professional presence and use the available agent tools without a subscription or payment.</p>
          </div>
          </aside>

          <section className={styles.block} aria-labelledby="features-heading">
          <div className={styles.blockHeading}>
            <p className={styles.stepLabel}>Included with your account</p>
            <h2 id="features-heading">Everything You Get as a Dhalahore Agent</h2>
          </div>
          <div className={styles.featureGrid}>
            {FEATURES.map(([Icon, title, copy]) => (
              <div className={styles.featureItem} key={title}>
                <Icon size={19} aria-hidden="true" />
                <div><h3>{title}</h3><p>{copy}</p></div>
              </div>
            ))}
          </div>
          </section>

          <section className={styles.closing} aria-labelledby="cta-heading">
            <h2 id="cta-heading">Ready to Get Started?</h2>
            <p>Create your professional Dhalahore presence for free.</p>
          </section>
        </div>

        <div className={styles.actionBar}>
          <label className={styles.consentRow}>
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>I accept the <Link href="/privacy-policy">Privacy Policy</Link> of this site.</span>
          </label>
          <Link href={accepted ? "/agent/signup" : "#"} className={`${styles.signupButton} ${!accepted ? styles.signupButtonDisabled : ""}`} aria-disabled={!accepted} tabIndex={accepted ? 0 : -1} onClick={(event) => { if (!accepted) event.preventDefault(); }}>
            Sign Up Now <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </article>
    </main>
  );
}
