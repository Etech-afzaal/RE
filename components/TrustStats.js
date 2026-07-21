"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./TrustStats.module.css";

function useCountUp(target, active, duration = 1400) {
  const [value, setValue] = useState(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      reducedMotion.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
    }
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const end = Math.max(0, Number(target) || 0);
    if (reducedMotion.current || end === 0) {
      setValue(end);
      return undefined;
    }

    let frame;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(end * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, duration]);

  return value;
}

function StatValue({ value, suffix = "", active, animate }) {
  const counted = useCountUp(animate ? value : 0, active);
  const display = animate ? counted : value;
  return (
    <strong>
      {display}
      {suffix}
    </strong>
  );
}

export default function TrustStats({ stats, backgroundImage }) {
  const sectionRef = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={styles.trustBand}
      aria-label="Marketplace trust"
    >
      {backgroundImage ? (
        <Image
          src={backgroundImage}
          alt=""
          fill
          sizes="(max-width: 1240px) 100vw, 1240px"
          className={styles.bgImage}
        />
      ) : null}
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.intro}>
          <p className={styles.kicker}>Trusted marketplace</p>
          <h2 className={styles.title}>Built for confident buyers</h2>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <StatValue
              value={stats.activeListings}
              suffix="+"
              active={active}
              animate
            />
            <span>Active listings</span>
          </div>
          <div className={styles.stat}>
            <StatValue value={stats.activeAgents} active={active} animate />
            <span>Verified agents</span>
          </div>
          <div className={styles.stat}>
            <StatValue value={stats.locations} active={active} animate />
            <span>Lahore locations</span>
          </div>
          <div className={styles.stat}>
            <StatValue value="Direct" active={active} animate={false} />
            <span>Agent messaging</span>
          </div>
        </div>
      </div>
    </section>
  );
}
