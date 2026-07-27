"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import styles from "./CustomerHome.module.css";

const CUSTOMER_NAV = [
  { label: "Home", href: "/" },
  { label: "Find agents", href: "#agents" },
  { label: "Why us", href: "#why-us" },
  { label: "Contact", href: "#contact" },
];

const WHY_ITEMS = [
  {
    title: "Verified Agents",
    copy: "Every agent is manually approved before they can publish a public estate page.",
  },
  {
    title: "Local Market Experts",
    copy: "Work with specialists who know DHA, Bahria, Gulberg, and Lahore neighbourhoods.",
  },
  {
    title: "Trusted Property Guidance",
    copy: "Clear listing details and direct contact — no middlemen or opaque fees.",
  },
  {
    title: "Direct Agent Contact",
    copy: "Message the listing agent from their branded page and book a viewing fast.",
  },
];

function formatAgency(agent) {
  return String(agent.username || agent.estate_name || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function agentMatchesArea(agent, area) {
  if (!area || area === "all") return true;
  const needle = area.toLowerCase();
  const fromListings = (agent.listing_locations || []).some((loc) =>
    String(loc).toLowerCase().includes(needle),
  );
  const fromServed = String(agent.areas_served || "")
    .toLowerCase()
    .includes(needle);
  return fromListings || fromServed;
}

function agentMatchesCity(agent, city) {
  if (!city || city === "all") return true;
  const needle = city.toLowerCase();
  const haystack = [
    agent.areas_served,
    ...(agent.listing_locations || []),
    agent.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function agentMatchesQuery(agent, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    agent.full_name,
    agent.username,
    agent.estate_name,
    agent.areas_served,
    agent.description,
    ...(agent.listing_locations || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function AgentCard({ agent }) {
  const href = `/re/${encodeURIComponent(agent.username || agent.estate_name)}`;
  const areas =
    agent.areas_served ||
    (agent.listing_locations || []).slice(0, 3).join(", ") ||
    "Lahore";

  return (
    <article className={styles.agentCard}>
      <div className={styles.agentMedia}>
        {agent.profile_image ? (
          <Image
            src={agent.profile_image}
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 33vw"
            className={styles.agentImage}
          />
        ) : (
          <div className={styles.agentFallback} aria-hidden="true">
            {(agent.full_name || "A").charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className={styles.agentBody}>
        <p className={styles.agentAgency}>{formatAgency(agent)}</p>
        <h3 className={styles.agentName}>{agent.full_name}</h3>
        <p className={styles.agentMeta}>
          {agent.property_count}{" "}
          {agent.property_count === 1 ? "property" : "properties"}
        </p>
        <p className={styles.agentAreas}>
          <span className={styles.agentAreasLabel}>Areas</span>
          {areas}
        </p>
        <Link href={href} className={styles.viewProfile}>
          View Profile
        </Link>
      </div>
    </article>
  );
}

export default function CustomerHome({ agents = [], areas = [] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [city, setCity] = useState("all");

  const filtered = useMemo(() => {
    return agents.filter(
      (agent) =>
        agentMatchesQuery(agent, query) &&
        agentMatchesArea(agent, area) &&
        agentMatchesCity(agent, city),
    );
  }, [agents, query, area, city]);

  const heroImage =
    agents.find((a) => a.profile_image)?.profile_image || "/hero/1.jpg";

  return (
    <div className={styles.wrapper}>
      <SiteHeader navLinks={CUSTOMER_NAV} />

      <section className={styles.hero} aria-label="Find agents">
        <div className={styles.heroMedia} aria-hidden="true">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.heroImage}
          />
          <div className={styles.heroScrim} />
        </div>
        <div className={styles.heroInner}>
          <p className={styles.kickerLight}>Dhalahore Properties</p>
          <h1 className={styles.heroTitle}>
            Find Trusted Real Estate Experts in DHA Lahore
          </h1>
          <p className={styles.heroSubtitle}>
            Connect with verified agents who understand your area and property
            needs.
          </p>
          <div className={styles.heroActions}>
            <a href="#agents" className={styles.btnPrimary}>
              Search agents
            </a>
            <a href="#agents" className={styles.btnGhost}>
              Browse Agents
            </a>
          </div>
        </div>
      </section>

      <main className={styles.main}>
        <div className={styles.container}>
          <section id="agents" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Find an agent</p>
                <h2 className={styles.sectionTitle}>
                  Verified estate agents across Lahore
                </h2>
              </div>
              <p className={styles.count}>
                {filtered.length}{" "}
                {filtered.length === 1 ? "agent" : "agents"}
              </p>
            </div>

            <div className={styles.searchBar}>
              <div className={styles.searchField}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M20 20l-3.5-3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, agency, or expertise"
                  aria-label="Search agents"
                />
              </div>
              <label className={styles.selectField}>
                <span className={styles.srOnly}>Area</span>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  aria-label="Filter by area"
                >
                  <option value="all">All areas</option>
                  {areas.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.selectField}>
                <span className={styles.srOnly}>City</span>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  aria-label="Filter by city"
                >
                  <option value="all">All cities</option>
                  <option value="Lahore">Lahore</option>
                  <option value="DHA">DHA</option>
                  <option value="Bahria">Bahria</option>
                </select>
              </label>
              <button
                type="button"
                className={styles.searchBtn}
                onClick={() => {
                  document
                    .getElementById("agent-grid")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Search
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className={styles.empty}>
                No agents match your filters. Try another area or{" "}
                <Link href="/agent/signup">become an agent</Link>.
              </div>
            ) : (
              <div id="agent-grid" className={styles.agentGrid}>
                {filtered.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </section>

          <section id="why-us" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Why Dhalahore</p>
                <h2 className={styles.sectionTitle}>
                  Why choose DhaLahore
                </h2>
              </div>
            </div>
            <div className={styles.whyGrid}>
              {WHY_ITEMS.map((item) => (
                <div key={item.title} className={styles.whyCard}>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.sellCta}>
            <div className={styles.sellCtaOverlay} aria-hidden="true" />
            <div className={styles.sellCopy}>
              <p className={styles.kickerLight}>For estate agents</p>
              <h2>List your properties. Reach serious buyers.</h2>
              <p>
                Get a branded page at{" "}
                <strong>dhalahore.com/re/your-estate</strong> and manage your
                portfolio in one place.
              </p>
            </div>
            <div className={styles.sellActions}>
              <Link href="/agent/signup" className={styles.btnPrimary}>
                Become an Agent
              </Link>
              <Link href="/agent/login" className={styles.btnGhost}>
                Agent login
              </Link>
            </div>
          </section>

          <section id="contact" className={styles.contactSection}>
            <div className={styles.contactCard}>
              <p className={styles.contactKicker}>CONTACT</p>
              <h2 className={styles.contactHeading}>
                Questions about buying or listing?
              </h2>
              <p className={styles.contactCopy}>
                Browse verified agents above, or reach the Dhalahore team for
                guidance.
              </p>
              <div className={styles.contactRow}>
                <a href="tel:+923001234567">+92 300 123 4567</a>
                <a href="mailto:info@dhalahore.com">info@dhalahore.com</a>
                <span>12 Garden Town, Lahore</span>
              </div>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerAccent} aria-hidden="true" />
          <div className={styles.footerInner}>
            <div className={styles.footerBrand}>
              <Image
                src="/logo-white.svg"
                alt="Dhalahore Properties"
                width={155}
                height={43}
              />
              <p>
                Find trusted Lahore estate agents — verified profiles, direct
                contact, clear listings.
              </p>
            </div>
            <div className={styles.footerCol}>
              <h4>Explore</h4>
              <a href="#agents">Find agents</a>
              <a href="#why-us">Why us</a>
              <Link href="/agent/signup">Become an agent</Link>
            </div>
            <div className={styles.footerCol}>
              <h4>Accounts</h4>
              <Link href="/agent/login">Agent login</Link>
              <Link href="/admin/login">Admin login</Link>
              <Link href="/agent/signup">Register</Link>
            </div>
            <div className={styles.footerCol}>
              <h4>Contact</h4>
              <a href="tel:+923001234567">+92 300 123 4567</a>
              <a href="mailto:info@dhalahore.com">info@dhalahore.com</a>
              <span>12 Garden Town, Lahore</span>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} Dhalahore Properties</span>
            <span>Trusted Lahore agents</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
