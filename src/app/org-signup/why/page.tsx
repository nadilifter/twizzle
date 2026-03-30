"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Users,
  Trophy,
  GraduationCap,
  CreditCard,
  MessageSquare,
  Monitor,
} from "lucide-react";
import { SparklesCore } from "@/components/ui/sparkles";
import { LampContainer } from "@/components/ui/lamp";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import { WavyBackground } from "@/components/ui/wavy-background";
import WorldMap from "@/components/ui/world-map";

const features = [
  {
    icon: Users,
    title: "Registration & Classes",
    description:
      "Streamlined online registration with waitlists, session management, and real-time availability.",
  },
  {
    icon: Trophy,
    title: "Competitions & Judging",
    description:
      "End-to-end competition management from registration through scoring and results publishing.",
  },
  {
    icon: GraduationCap,
    title: "Training & Progression",
    description:
      "Skill tracking, evaluation templates, and training plans that follow every athlete's journey.",
  },
  {
    icon: CreditCard,
    title: "Payments & Billing",
    description:
      "Integrated payment processing, automated invoicing, and flexible discount management.",
  },
  {
    icon: MessageSquare,
    title: "Communication",
    description:
      "Built-in SMS, email campaigns, push notifications, and in-app announcements in one hub.",
  },
  {
    icon: Monitor,
    title: "Multi-Portal Architecture",
    description:
      "Dedicated portals for parents, athletes, coaches, front desk, and administrators.",
  },
];

const mapConnections = [
  { start: { lat: 34.05, lng: -118.24 }, end: { lat: 40.71, lng: -74.0 } },
  { start: { lat: 40.71, lng: -74.0 }, end: { lat: 51.5, lng: -0.12 } },
  { start: { lat: 51.5, lng: -0.12 }, end: { lat: 35.68, lng: 139.69 } },
  { start: { lat: 34.05, lng: -118.24 }, end: { lat: -33.87, lng: 151.21 } },
  { start: { lat: 40.71, lng: -74.0 }, end: { lat: 48.86, lng: 2.35 } },
  { start: { lat: 35.68, lng: 139.69 }, end: { lat: 1.35, lng: 103.82 } },
  { start: { lat: 48.86, lng: 2.35 }, end: { lat: 55.75, lng: 37.62 } },
  { start: { lat: 34.05, lng: -118.24 }, end: { lat: 19.43, lng: -99.13 } },
];

const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" as const },
};

export default function WhyPage() {
  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto scroll-smooth">
      {/* Back button */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-[60] flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors backdrop-blur-sm bg-black/20 rounded-full px-3 py-1.5"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back</span>
      </Link>

      {/* ================================================================ */}
      {/* Section 1: Hero – "Uplifter 2.0" with sparkles                  */}
      {/* ================================================================ */}
      <section className="h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden relative">
        <h1 className="md:text-7xl text-3xl lg:text-9xl font-bold text-center text-white relative z-20">
          Uplifter 2.0
        </h1>
        <div className="w-[40rem] h-40 relative">
          <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
          <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
          <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
          <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

          <SparklesCore
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={1200}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />

          <div className="absolute inset-0 w-full h-full bg-black [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]" />
        </div>

        <motion.div
          className="absolute bottom-10 flex flex-col items-center gap-2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-white/40 text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/40 to-transparent" />
        </motion.div>
      </section>

      {/* ================================================================ */}
      {/* Section 2: Vision – full-page sparkles                           */}
      {/* ================================================================ */}
      <section className="min-h-screen relative w-full bg-black flex flex-col items-center justify-center overflow-hidden">
        <div className="w-full absolute inset-0 h-full">
          <SparklesCore
            id="tsparticlesfullpage"
            background="transparent"
            minSize={0.6}
            maxSize={1.4}
            particleDensity={100}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />
        </div>
        <div className="relative z-20 flex flex-col items-center max-w-3xl mx-auto px-6">
          <motion.h2
            {...fadeUp}
            transition={{ duration: 1, ease: "easeOut" }}
            className="md:text-7xl text-3xl lg:text-6xl font-bold text-center text-white mb-8"
          >
            The future of gymnastics management
          </motion.h2>
          <TextGenerateEffect
            words="One platform to run your entire gym. Registration, training, competitions, payments, and parent communication — unified, modern, and built to scale."
            className="text-center text-white/80"
            duration={0.3}
          />
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 3: Lamp – value proposition                              */}
      {/* ================================================================ */}
      <section>
        <LampContainer>
          <motion.div
            initial={{ opacity: 0.5, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            viewport={{ once: true }}
            className="flex flex-col items-center"
          >
            <h2 className="mt-8 bg-gradient-to-br from-slate-300 to-slate-500 py-4 bg-clip-text text-center text-4xl font-medium tracking-tight text-transparent md:text-7xl">
              Everything your gym needs.
              <br />
              Nothing it doesn&apos;t.
            </h2>
            <p className="mt-6 max-w-2xl text-center text-base md:text-lg text-slate-400 leading-relaxed">
              Uplifter replaces the patchwork of disconnected tools gyms rely on today. A single,
              white-labeled platform gives every stakeholder&mdash;owners, coaches, parents, and
              athletes&mdash;exactly the experience they need, under your brand.
            </p>
          </motion.div>
        </LampContainer>
      </section>

      {/* ================================================================ */}
      {/* Section 4: World Map – global athlete connectivity               */}
      {/* ================================================================ */}
      <section className="min-h-screen relative w-full bg-black flex flex-col items-center justify-center overflow-hidden py-24 px-6">
        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <motion.h2
            {...fadeUp}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-3xl md:text-5xl font-bold text-center text-white mb-4"
          >
            Connecting athletes everywhere
          </motion.h2>
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
            className="text-center text-slate-400 mb-12 max-w-xl mx-auto text-lg"
          >
            From local meets to international competitions, Uplifter brings gyms, athletes, and
            families together no matter where they are.
          </motion.p>

          <motion.div {...fadeUp} transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}>
            <WorldMap dots={mapConnections} lineColor="#6366F1" dark />
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 5: Features – shooting stars background                  */}
      {/* ================================================================ */}
      <section className="min-h-screen relative w-full bg-black flex flex-col items-center justify-center overflow-hidden py-24 px-6">
        <StarsBackground starDensity={0.0003} allStarsTwinkle twinkleProbability={0.8} />
        <ShootingStars starColor="#6366F1" trailColor="#8B5CF6" minDelay={2000} maxDelay={5000} />

        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <motion.h2
            {...fadeUp}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-3xl md:text-5xl font-bold text-center text-white mb-4"
          >
            Built for the way gyms actually work
          </motion.h2>
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="text-center text-slate-400 mb-16 max-w-xl mx-auto"
          >
            Six core pillars, one seamless experience. Every feature designed for the unique demands
            of gymnastics organizations.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                viewport={{ once: true, margin: "-40px" }}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300"
              >
                <feature.icon className="h-8 w-8 text-indigo-400 mb-4 group-hover:text-indigo-300 transition-colors" />
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 6: CTA – wavy background                                */}
      {/* ================================================================ */}
      <section className="relative w-full overflow-hidden">
        <WavyBackground
          colors={["#6366F1", "#8B5CF6", "#A78BFA", "#818CF8", "#22D3EE"]}
          waveOpacity={0.3}
          blur={12}
          speed="slow"
          backgroundFill="black"
          containerClassName="min-h-screen"
          className="flex flex-col items-center max-w-2xl mx-auto px-6 text-center"
        >
          <motion.h2
            {...fadeUp}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-3xl md:text-6xl font-bold text-white mb-6"
          >
            Ready to transform your gym?
          </motion.h2>
          <motion.p
            {...fadeUp}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="text-lg text-slate-300 mb-10"
          >
            Join the next generation of gymnastics management. Start your 30-day free trial today.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            viewport={{ once: true }}
          >
            <Link
              href="/"
              className="group relative inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-black transition-all duration-300 hover:shadow-[0_0_40px_8px_rgba(99,102,241,0.4)] hover:scale-105"
            >
              Get Started
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          </motion.div>
        </WavyBackground>
      </section>
    </div>
  );
}
