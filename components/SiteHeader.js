import Link from "next/link";
import Image from "next/image";
import styles from "./SiteHeader.module.css";

const TOP_LINKS = [
  { label: "Newly Listed Home", href: "#listings" },
  { label: "Lowest Price", href: "#listings" },
  { label: "Offer", href: "#why-us" },
];

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "For Sale", href: "#listings" },
  { label: "For Rent", href: "#listings" },
  { label: "Property", href: "#listings" },
  { label: "Areas", href: "#areas" },
  { label: "Contact Us", href: "#why-us" },
];

export default function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Link href="/" className={styles.logoGroup}>
            <Image
              src="/logo.svg"
              alt="Dhalahore Properties"
              width={130}
              height={44}
              priority
            />
          </Link>

          <nav className={styles.topLinks} aria-label="Quick links">
            {TOP_LINKS.map((link) => (
              <a key={link.label} href={link.href} className={styles.topLink}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className={styles.bottomRow}>
          <nav className={styles.mainNav} aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className={styles.navLink}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            <Link href="/agent/login" className={styles.agentButton}>
              Become an agent
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
