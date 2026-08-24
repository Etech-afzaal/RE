"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AgentAvatar from "@/components/AgentAvatar";
import SiteHeader from "@/components/SiteHeader";
import { useIsMobile } from "@/lib/useIsMobile";
import { useLocationDetection } from "@/lib/useLocationDetection";
import { validateContactInput } from "@/lib/validators/inquiryValidator";
import { sanitizeSearchInput } from "@/lib/validators/common";
import styles from "./CustomerHome.module.css";

const DESKTOP_AGENT_PAGE_SIZE = 9;
const MOBILE_AGENT_PAGE_SIZE = 10;
const CUSTOMER_NAV = [
  { label: "Home", href: "/" },
  { label: "Find agents", href: "#agents" },
  { label: "Why us", href: "#why-us" },
  { label: "Contact", href: "#contact" },
];

const WHY_ITEMS = [
  {
    title: "Verified Agents",
    icon: "shield-check",
    copy: "Every agent is manually approved before they can publish a public estate page.",
  },
  {
    title: "Local Market Experts",
    icon: "map-pin",
    copy: "Work with specialists who know DHA, Bahria, Gulberg, and Lahore neighbourhoods.",
  },
  {
    title: "Trusted Property Guidance",
    icon: "home",
    copy: "Clear listing details and direct contact — no middlemen or opaque fees.",
  },
  {
    title: "Direct Agent Contact",
    icon: "message-circle",
    copy: "Message the listing agent from their branded page and book a viewing fast.",
  },
];

function WhyIcon({ name }) {
  const paths = {
    "shield-check": (
      <>
        <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    "map-pin": (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    home: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    "message-circle": (
      <>
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z" />
        <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
      </>
    ),
  };

  return (
    <svg
      className={styles.whyIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const CONTACT_FAQS = [
  {
    question: "How can I find a trusted real estate agent in Lahore?",
    answer:
      "Browse verified agents on DhaLahore.com and explore their profiles, areas of expertise, and available properties.",
  },
  {
    question: "Can I buy, sell, or rent properties through DhaLahore.com?",
    answer:
      "Yes. DhaLahore.com connects customers with real estate agents who can help with buying, selling, and rental requirements across Lahore.",
  },
  {
    question: "Are the listed properties verified?",
    answer:
      "Properties are reviewed and managed by registered agents. Only approved listings are displayed publicly.",
  },
  {
    question: "Which areas of Lahore do your agents cover?",
    answer:
      "Our agents specialize in DHA Lahore, Bahria Town, Gulberg, Model Town, Johar Town, and other major Lahore areas.",
  },
  {
    question: "How do I contact an agent about a property?",
    answer:
      "You can visit an agent profile or property page and use the contact option to connect directly with the relevant agent.",
  },
  {
    question: "Can I become a real estate agent on DhaLahore.com?",
    answer:
      "Yes. Real estate professionals can register as agents and, after approval, manage their profiles and property listings.",
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
      <div className={styles.agentContent}>
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
        </div>
        <div className={styles.agentMedia}>
          {agent.profile_image ? (
            <Image
              src={agent.profile_image}
              alt=""
              fill
              sizes="(max-width: 768px) 72px, 110px"
              className={styles.agentImage}
            />
          ) : (
            <AgentAvatar
              src={null}
              alt=""
              fill
              sizes="(max-width: 768px) 72px, 110px"
              className={styles.agentImage}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
      <Link href={href} className={styles.viewProfile}>
        View Listing
      </Link>
    </article>
  );
}

const EMPTY_CONTACT_FORM = {
  full_name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
};

export default function CustomerHome({ agents = [], areas = [], cities = [] }) {
  const isMobile = useIsMobile(768);
  const pageSize = isMobile ? MOBILE_AGENT_PAGE_SIZE : DESKTOP_AGENT_PAGE_SIZE;
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [city, setCity] = useState("all");
  const [detectedArea, setDetectedArea] = useState(null);
  const [noMatchArea, setNoMatchArea] = useState(null);
  const [locationFilterActive, setLocationFilterActive] = useState(false);
  const { selectedArea, status, detectedLabel } = useLocationDetection({
    areas,
    enabled: typeof window !== "undefined",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [openFaqs, setOpenFaqs] = useState(() => new Set());
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM);
  const [contactFieldErrors, setContactFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState(false);
  const feedbackTimerRef = useRef(null);
  const searchInputRef = useRef(null);
  const locationDetectionHandledRef = useRef(false);

  const filtered = useMemo(() => {
    if (locationFilterActive && noMatchArea) return [];
    return agents.filter(
      (agent) =>
        agentMatchesQuery(agent, query) &&
        agentMatchesArea(agent, area) &&
        agentMatchesCity(agent, city),
    );
  }, [agents, query, area, city, locationFilterActive, noMatchArea]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  const paginationRange = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    let start = Math.max(1, safePage - 2);
    let end = start + 4;

    if (end > totalPages) {
      end = totalPages;
      start = totalPages - 4;
    }

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  };

  // Detection runs once; manual controls always take ownership afterward.
  useEffect(() => {
    if (locationDetectionHandledRef.current) return;

    if (status === "no_match" && detectedLabel) {
      locationDetectionHandledRef.current = true;
      setNoMatchArea(detectedLabel);
      setLocationFilterActive(true);
      return;
    }
    if (status === "resolved" && selectedArea) {
      locationDetectionHandledRef.current = true;
      setArea(selectedArea);
      setDetectedArea(selectedArea);
      setLocationFilterActive(true);
    }
  }, [status, selectedArea, detectedLabel]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, area, city, pageSize]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  function clearFeedback() {
    setSuccessMessage(false);
    setErrorMessage(false);
  }

  function showFeedback(type) {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    if (type === "success") {
      setSuccessMessage(true);
      setErrorMessage(false);
    } else {
      setErrorMessage(true);
      setSuccessMessage(false);
    }

    feedbackTimerRef.current = setTimeout(() => {
      clearFeedback();
      feedbackTimerRef.current = null;
    }, 2500);
  }

  function handlePageChange(page) {
    setCurrentPage(page);
    document
      .getElementById("agents")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function findAllAgents() {
    setQuery("");
    setArea("all");
    setCity("all");
    setDetectedArea(null);
    setNoMatchArea(null);
    setLocationFilterActive(false);
  }

  function searchAllAgents() {
    findAllAgents();
    searchInputRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    searchInputRef.current?.focus({ preventScroll: true });
  }

  function toggleFaq(index) {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const allFaqsExpanded = openFaqs.size === CONTACT_FAQS.length;

  function toggleExpandAllFaqs() {
    if (allFaqsExpanded) {
      setOpenFaqs(new Set());
      return;
    }
    setOpenFaqs(new Set(CONTACT_FAQS.map((_, index) => index)));
  }

  function handleContactFieldChange(field) {
    return (event) => {
      let value = event.target.value;
      if (field === "full_name") {
        value = value.replace(/[^\p{L}\s'-]/gu, "").slice(0, 30);
      } else if (field === "phone") {
        const hasPlus = value.trimStart().startsWith("+");
        const digits = value.replace(/\D/g, "").slice(0, 15);
        value = hasPlus ? `+${digits}` : digits;
      } else if (field === "subject") {
        value = value.slice(0, 50);
      }
      setContactForm((prev) => ({ ...prev, [field]: value }));
      if (contactFieldErrors[field]) {
        setContactFieldErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    };
  }

  async function handleContactSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const validated = validateContactInput(contactForm);
    if (!validated.ok) {
      setContactFieldErrors(
        validated.field ? { [validated.field]: validated.error } : {},
      );
      return;
    }

    setIsSubmitting(true);
    clearFeedback();
    setContactFieldErrors({});

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: validated.data.full_name,
          email: validated.data.email,
          phone: validated.data.phone,
          subject: validated.data.subject,
          message: validated.data.message,
          page_url:
            typeof window !== "undefined" ? window.location.pathname : "/",
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to send message.");
      }

      setContactForm(EMPTY_CONTACT_FORM);
      showFeedback("success");
    } catch {
      showFeedback("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <SiteHeader navLinks={CUSTOMER_NAV} />

      <div className={styles.searchSection}>
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
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(sanitizeSearchInput(e.target.value).value);
                setDetectedArea(null);
                setNoMatchArea(null);
                setLocationFilterActive(false);
              }}
              placeholder="Search by area, name, agency, or expertise"
              aria-label="Search agents"
            />
          </div>
          <label className={styles.selectField}>
            <span className={styles.srOnly}>Area</span>
            <select
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setDetectedArea(null);
                setNoMatchArea(null);
                setLocationFilterActive(false);
              }}
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
              onChange={(e) => {
                setCity(e.target.value);
                setDetectedArea(null);
                setNoMatchArea(null);
                setLocationFilterActive(false);
              }}
              aria-label="Filter by city"
            >
              <option value="all">All cities</option>
              {cities.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
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
      </div>

      <section className={styles.hero} aria-label="Find agents">
        <div className={styles.heroMedia} aria-hidden="true">
          <Image
            src="/hero/2.jpg"
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

            {filtered.length === 0 ? (
              <div className={styles.empty}>
                {locationFilterActive && (detectedArea || noMatchArea) ? (
                  <>
                    <p className={styles.emptyTitle}>No agents in your area</p>
                    <p className={styles.emptyCopy}>
                      We couldn't find any agents in {detectedArea || noMatchArea} yet.
                    </p>
                    <div className={styles.emptyActions}>
                      <button
                        type="button"
                        className={styles.pageButton}
                        onClick={findAllAgents}
                      >
                        Find All Agents
                      </button>
                      <button
                        type="button"
                        className={styles.pageButton}
                        onClick={searchAllAgents}
                      >
                        Search All Agents
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    No agents match your filters. Try another area or{" "}
                    <Link href="/agent/signup">become an agent</Link>.
                  </>
                )}
              </div>
            ) : (
              <>
                <div id="agent-grid" className={styles.agentGrid}>
                  {pageItems.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
                {totalPages > 1 ? (
                  <div className={styles.pagination}>
                    {safePage > 1 ? (
                      <button
                        type="button"
                        className={styles.pageButton}
                        onClick={() => handlePageChange(safePage - 1)}
                      >
                        &lt;
                      </button>
                    ) : null}

                    {paginationRange().map((page) => (
                      <button
                        key={page}
                        type="button"
                        className={`${styles.pageButton} ${
                          page === safePage ? styles.pageButtonActive : ""
                        }`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    ))}

                    {safePage < totalPages ? (
                      <button
                        type="button"
                        className={styles.pageButton}
                        onClick={() => handlePageChange(safePage + 1)}
                      >
                        &gt;
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
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
                  <h3 className={styles.whyHeading}>
                    <WhyIcon name={item.icon} />
                    {item.title}
                  </h3>
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
                Agent Login
              </Link>
            </div>
          </section>

          <section id="contact" className={styles.contactSection}>
            <div className={styles.contactCard}>
              <div className={styles.contactGrid}>
                <div className={styles.contactInfo}>
                  <div className={styles.faqHeader}>
                    <h2 className={styles.contactHeading}>
                      Frequently Asked Questions
                    </h2>
                    <button
                      type="button"
                      className={styles.faqExpandAll}
                      onClick={toggleExpandAllFaqs}
                      aria-expanded={allFaqsExpanded}
                    >
                      {allFaqsExpanded ? "Collapse All" : "Expand All"}
                    </button>
                  </div>
                  <div className={styles.faqList}>
                    {CONTACT_FAQS.map((item, index) => {
                      const isOpen = openFaqs.has(index);
                      return (
                        <div key={item.question} className={styles.faqItem}>
                          <button
                            type="button"
                            className={`${styles.faqQuestion}${isOpen ? ` ${styles.faqQuestionActive}` : ""}`}
                            aria-expanded={isOpen}
                            onClick={() => toggleFaq(index)}
                          >
                            <span className={styles.faqQuestionText}>
                              {item.question}
                            </span>
                            <span className={styles.faqToggle} aria-hidden="true">
                              {isOpen ? "−" : "+"}
                            </span>
                          </button>
                          {isOpen ? (
                            <div className={styles.faqAnswerPanel}>
                              <p className={styles.faqAnswerText}>
                                {item.answer}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.contactFormPanel}>
                  <p className={styles.contactFormKicker}>Send a Message</p>
                  <form
                    className={styles.contactForm}
                    onSubmit={handleContactSubmit}
                    noValidate
                  >
                    <div className={styles.contactFields}>
                      <label className={styles.formField}>
                        <span className={styles.formLabel}>Full Name</span>
                        <input
                          type="text"
                          name="full_name"
                          required
                          maxLength={30}
                          value={contactForm.full_name}
                          onChange={handleContactFieldChange("full_name")}
                          placeholder="Full Name"
                          className={styles.contactInput}
                          disabled={isSubmitting}
                          aria-invalid={Boolean(contactFieldErrors.full_name)}
                        />
                        {contactFieldErrors.full_name ? (
                          <span className={styles.fieldError}>
                            {contactFieldErrors.full_name}
                          </span>
                        ) : null}
                      </label>
                      <label className={styles.formField}>
                        <span className={styles.formLabel}>Email Address</span>
                        <input
                          type="email"
                          name="email"
                          required
                          value={contactForm.email}
                          onChange={handleContactFieldChange("email")}
                          placeholder="Email Address"
                          className={styles.contactInput}
                          disabled={isSubmitting}
                          aria-invalid={Boolean(contactFieldErrors.email)}
                        />
                        {contactFieldErrors.email ? (
                          <span className={styles.fieldError}>
                            {contactFieldErrors.email}
                          </span>
                        ) : null}
                      </label>
                      <label className={styles.formField}>
                        <span className={styles.formLabel}>Phone Number</span>
                        <input
                          type="tel"
                          name="phone"
                          maxLength={16}
                          value={contactForm.phone}
                          onChange={handleContactFieldChange("phone")}
                          placeholder="Phone Number"
                          className={styles.contactInput}
                          disabled={isSubmitting}
                          aria-invalid={Boolean(contactFieldErrors.phone)}
                        />
                        {contactFieldErrors.phone ? (
                          <span className={styles.fieldError}>
                            {contactFieldErrors.phone}
                          </span>
                        ) : null}
                      </label>
                      <label className={styles.formField}>
                        <span className={styles.formLabel}>Subject</span>
                        <input
                          type="text"
                          name="subject"
                          required
                          maxLength={50}
                          value={contactForm.subject}
                          onChange={handleContactFieldChange("subject")}
                          placeholder="Buying, selling, or renting"
                          className={styles.contactInput}
                          disabled={isSubmitting}
                          aria-invalid={Boolean(contactFieldErrors.subject)}
                        />
                        {contactFieldErrors.subject ? (
                          <span className={styles.fieldError}>
                            {contactFieldErrors.subject}
                          </span>
                        ) : null}
                      </label>
                      <label className={`${styles.formField} ${styles.messageField}`}>
                        <span className={styles.formLabel}>Message</span>
                        <textarea
                          name="message"
                          rows="5"
                          required
                          maxLength={1000}
                          value={contactForm.message}
                          onChange={handleContactFieldChange("message")}
                          placeholder="Write your message"
                          className={styles.contactTextarea}
                          disabled={isSubmitting}
                          aria-invalid={Boolean(contactFieldErrors.message)}
                        />
                        {contactFieldErrors.message ? (
                          <span className={styles.fieldError}>
                            {contactFieldErrors.message}
                          </span>
                        ) : null}
                      </label>
                    </div>
                    <button
                      type="submit"
                      className={`${styles.btnPrimary} ${styles.contactSubmit}`}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Sending..." : "Send Message"}
                    </button>
                  </form>

                  {successMessage || errorMessage ? (
                    <div
                      className={`${styles.contactFeedbackPopup} ${
                        successMessage
                          ? styles.contactFeedbackSuccess
                          : styles.contactFeedbackError
                      }`}
                      role={successMessage ? "status" : "alert"}
                      aria-live={successMessage ? "polite" : "assertive"}
                    >
                      {successMessage ? (
                        <>
                          <p className={styles.contactFeedbackTitle}>
                            ✓ Message sent successfully!
                          </p>
                          <p className={styles.contactFeedbackText}>
                            Thank you for contacting DhaLahore.
                            <br />
                            We will get back to you shortly.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className={styles.contactFeedbackTitle}>
                            ❌ Unable to send message.
                          </p>
                          <p className={styles.contactFeedbackText}>
                            Please try again.
                          </p>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
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
              <a href="#agents">Find Agents</a>
              <a href="#why-us">Why us</a>
              <Link href="/privacy-policy">Privacy Policy</Link>
            </div>
            <div className={styles.footerCol}>
              <h4>Accounts</h4>
              <Link href="/agent/login">Agent Login</Link>
              <Link href="/agent/signup">Become an Agent</Link>
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
