"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useSpring, useTransform } from "framer-motion";

const stats = [
  { value: 0, suffix: "", label: "Server Uploads", icon: "🚫" },
  { value: 6, suffix: "+", label: "Powerful Tools", icon: "⚡" },
  { value: 100, suffix: "%", label: "Local Processing", icon: "🔒" },
  { value: 0, suffix: "ms", label: "Upload Time", icon: "🚀" },
];

function AnimatedCounter({
  target,
  suffix,
}: {
  target: number;
  suffix: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    if (inView) spring.set(target);
  }, [inView, spring, target]);

  return (
    <span ref={ref} className="tabular-nums">
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}

export default function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="py-8"
    >
      <div
        className="rounded-2xl px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
            className="flex flex-col items-center text-center gap-1.5 py-2"
          >
            <span className="text-2xl mb-1">{stat.icon}</span>
            <div
              className="text-3xl sm:text-4xl font-extrabold tracking-tight"
              style={{
                background: "linear-gradient(135deg, var(--text-primary), rgba(255,255,255,0.6))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              <AnimatedCounter target={stat.value} suffix={stat.suffix} />
            </div>
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
