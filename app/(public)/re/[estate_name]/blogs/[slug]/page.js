import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import {
  getAgentByUsername,
} from "@/lib/queries";
import { getPublishedBlogByAgentAndSlug } from "@/lib/blogs";
import { agentPublicUsername } from "@/lib/propertySlug";
import { PUBLIC_SITE_LOGO_DIMENSIONS } from "@/components/publicSiteLogo";
import SiteHeader from "@/components/SiteHeader";
import AgentWhatsAppFab from "@/components/AgentWhatsAppFab";
import { agentPhoneEntries } from "@/lib/agentContact";
import { resolveAgentWhatsAppNumber, agentWebsiteWhatsAppMessage } from "@/lib/whatsapp";
import { formatAddedDate } from "@/lib/agentPropertyListingHelpers";
import styles from "./page.module.css";
import AdSlot from "@/components/ads/AdSlot";
import { BANNER_FORMATS } from "@/components/ads/adFormats";
import "@/app/agent-public-theme.css";

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return {};
  const blog = await getPublishedBlogByAgentAndSlug(
    agent.id,
    params.slug,
  );
  if (!blog) return {};
  return {
    title: `${blog.title} | ${agent.full_name} — Dhalahore Properties`,
    description: blog.short_description || `${blog.title} by ${agent.full_name}`,
  };
}

export default async function BlogDetailPage({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return notFound();

  const blog = await getPublishedBlogByAgentAndSlug(agent.id, params.slug);
  if (!blog) return notFound();

  const agentHandle = agentPublicUsername(agent);
  const agentHomeHref = `/re/${encodeURIComponent(agentHandle)}`;
  const blogsHref = `${agentHomeHref}#blogs`;
  const publishedDate = formatAddedDate(blog.created_at);

  const phoneEntries = agent ? agentPhoneEntries(agent) : [];
  const waNumber = agent ? resolveAgentWhatsAppNumber(agent) : null;
  const waMessage = agent ? agentWebsiteWhatsAppMessage(agent) : "";
  const waFabPhone = waNumber ? waNumber : null;
  const waFabMessage = waMessage || "I'd like to know more about your services.";

  const companyName =
    agent.company_name && String(agent.company_name).trim()
      ? String(agent.company_name).trim()
      : agent.estate_name || "Agency";

  return (
    <div className={`agent-public-theme ${styles.wrapper}`}>
      <SiteHeader
        navLinks={[]}
        ctaLabel="Contact"
        ctaHref="#contact"
        logoSrc={agent.company_logo || "/logo.svg"}
        logoAlt={agent.company_logo ? `${companyName} logo` : "Dhalahore Properties"}
      />

      <main className={styles.main}>
        <article className={styles.article}>
          <Link href={blogsHref} className={styles.backLink}>
            ← Back to articles
          </Link>

          <header className={styles.header}>
            <p className={styles.kicker}>Article</p>
            <h1 className={styles.title}>{blog.title}</h1>
            {blog.short_description ? (
              <p className={styles.description}>{blog.short_description}</p>
            ) : null}
            <div className={styles.meta}>
              <span className={styles.author}>
                By {agent.full_name || companyName}
              </span>
              {publishedDate ? (
                <>
                  <span className={styles.dot} aria-hidden="true">·</span>
                  <time className={styles.date}>{publishedDate}</time>
                </>
              ) : null}
            </div>
          </header>

          {blog.cover_image ? (
            <div className={styles.cover}>
              <Image
                src={blog.cover_image}
                alt={blog.title || "Blog cover image"}
                fill
                sizes="(max-width: 768px) 100vw, 860px"
                className={styles.coverImage}
                priority
              />
            </div>
          ) : null}

          {blog.content ? (
            <div className={styles.content}>
              {blog.content.split("\n").map((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                if (trimmed.length <= 120 && /^[A-Z0-9].*$/.test(trimmed)) {
                  return (
                    <h2 key={index} className={styles.subheading}>
                      {trimmed}
                    </h2>
                  );
                }
                return (
                  <p key={index} className={styles.paragraph}>
                    {trimmed}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className={styles.empty}>This article has no content yet.</p>
          )}

          <AdSlot placement="blog_post" formats={BANNER_FORMATS} spacing="section" />

          <section id="contact" className={styles.contactSection}>
            <div className={styles.contactCard}>
              <p className={styles.contactKicker}>Contact</p>
              <h2 className={styles.contactHeading}>
                Interested in working with {agent.full_name || companyName}?
              </h2>
              <p className={styles.contactCopy}>
                Reach out for buying, selling, or investment guidance.
              </p>
              <div className={styles.contactActions}>
                {phoneEntries.length > 0 ? (
                  <a
                    href={phoneEntries[0].href}
                    className={styles.contactButton}
                  >
                    Call {phoneEntries[0].number}
                  </a>
                ) : null}
                <Link href={agentHomeHref} className={styles.contactButtonGhost}>
                  View Listings
                </Link>
              </div>
            </div>
          </section>
        </article>
      </main>

      <AgentWhatsAppFab phone={waFabPhone} message={waFabMessage} />
    </div>
  );
}
