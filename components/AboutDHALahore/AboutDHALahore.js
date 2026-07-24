import styles from "./AboutDHALahore.module.css";

export default function AboutDHALahore() {
  return (
    <section className={styles.aboutSection} aria-labelledby="about-dha-heading">
      <div className={styles.inner}>
        <div className={styles.content}>
          <p className={styles.subtitle}>(Since 2026)</p>
          <h2 id="about-dha-heading" className={styles.heading}>
            Welcome to DHA Lahore Properties
          </h2>
          <p className={styles.intro}>Find your ideal property with confidence.</p>
          <p className={styles.description}>
            DHA Lahore Properties is a trusted platform dedicated to helping buyers, sellers, and investors discover premium real estate opportunities across DHA Lahore. Whether you are searching for a modern home, a commercial investment, or a residential plot, our platform connects you with verified listings and trusted agents. We are committed to providing transparent property information, competitive pricing, and a seamless property search experience, making it easier for you to make informed real estate decisions.
          </p>
          <div className={styles.signatureRow}>
            <div className={styles.signatureMark} aria-hidden="true">
              <p className={styles.signatureScript}>A. Rahman</p>
              <span className={styles.signatureLine} />
            </div>
            <div>
              <p className={styles.signatureName}>DHA Lahore Properties</p>
              <p className={styles.signatureTitle}>Trusted Real Estate Platform</p>
            </div>
          </div>
        </div>

        <div className={styles.statsCard}>
          <div className={styles.cardRow}>
            <div className={styles.iconWrapper}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className={styles.statValue}>10,000+</p>
              <p className={styles.statLabel}>Verified Listings</p>
            </div>
          </div>

          <div className={styles.cardRow}>
            <div className={styles.iconWrapper}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 10.5V20h16V10.5L12 4l-8 6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M8.5 20V13h7v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className={styles.statValue}>500+</p>
              <p className={styles.statLabel}>Trusted Agents</p>
            </div>
          </div>

          <div className={styles.cardRow}>
            <div className={styles.iconWrapper}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M7 14.5h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className={styles.statValue}>25+</p>
              <p className={styles.statLabel}>Areas Covered</p>
            </div>
          </div>

          <div className={styles.cardRow}>
            <div className={styles.iconWrapper}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 5 6.5v5c0 4.5 3.6 8.5 7 9 3.4-.5 7-4.5 7-9v-5L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M9 12.5l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className={styles.statValue}>100%</p>
              <p className={styles.statLabel}>Verified Properties</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
