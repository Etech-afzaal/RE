import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAgentByUsername,
} from "@/lib/queries";
import { getPublishedVideoPostByAgentAndSlug } from "@/lib/videoPosts";
import { agentPublicUsername } from "@/lib/propertySlug";
import SiteHeader from "@/components/SiteHeader";
import AgentWhatsAppFab from "@/components/AgentWhatsAppFab";
import LazyVideoPlayer from "@/components/LazyVideoPlayer";
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
  const videoPost = await getPublishedVideoPostByAgentAndSlug(
    agent.id,
    params.slug,
  );
  if (!videoPost) return {};
  return {
    title: `${videoPost.title} | ${agent.full_name} — Dhalahore Properties`,
    description: videoPost.description || `${videoPost.title} by ${agent.full_name}`,
  };
}

export default async function VideoPostDetailPage({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return notFound();

  const videoPost = await getPublishedVideoPostByAgentAndSlug(agent.id, params.slug);
  if (!videoPost) return notFound();

  const agentHandle = agentPublicUsername(agent);
  const agentHomeHref = `/re/${encodeURIComponent(agentHandle)}`;
  const videosHref = `${agentHomeHref}#videos`;
  const publishedDate = formatAddedDate(videoPost.created_at);

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
        navLinks={[{ label: "Home", href: agentHomeHref }]}
        ctaLabel="Contact"
        ctaHref="#contact"
        logoSrc={agent.company_logo || "/logo.svg"}
        logoAlt={agent.company_logo ? `${companyName} logo` : "Dhalahore Properties"}
      />

      <main className={styles.main}>
        <article className={styles.article}>
          <Link href={videosHref} className={styles.backLink}>
            ← Back to videos
          </Link>

          <header className={styles.header}>
            <p className={styles.kicker}>Video</p>
            <h1 className={styles.title}>{videoPost.title}</h1>
            {videoPost.description ? (
              <p className={styles.description}>{videoPost.description}</p>
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

          {videoPost.video_url ? (
            <div className={styles.player}>
              <LazyVideoPlayer
                videoUrl={videoPost.video_url}
                thumbnailUrl={videoPost.thumbnail_url}
                title={videoPost.title}
              />
            </div>
          ) : (
            <p className={styles.empty}>This video is not available.</p>
          )}

          <AdSlot placement="video_post" formats={BANNER_FORMATS} spacing="section" />

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
