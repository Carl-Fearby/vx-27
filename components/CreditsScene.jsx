"use client";

import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import Link from "next/link";
import * as THREE from "three";
import {
  createSoundManager,
  DEFAULT_LEVEL_TRACK_ID,
  DEFAULT_LOADING_TRACK_ID,
  loadStoredLoadingTrackId,
  MUSIC_TRACK_KEY,
  MUSIC_TRACKS,
} from "@/lib/audio/Sound";
import CreditsRiflePreview from "@/components/CreditsRiflePreview";
import CreditsAmmoCratePreview from "@/components/CreditsAmmoCratePreview";
import CreditsVx27ContainerPreview from "@/components/CreditsVx27ContainerPreview";
import CreditsBigBangFinale from "@/components/CreditsBigBangFinale";
import CreditsScanlineCanvas from "@/components/CreditsScanlineCanvas";
import LoadingAudioViz from "@/components/LoadingAudioViz";
import { preloadCreditsAssets } from "@/lib/credits/preloadCreditsAssets";
import { setCreditsPreviewPaused } from "@/lib/credits/creditsPreviewScheduler";
import {
  GOLD_STAFF,
  PRODUCTION_STAFF,
  PRODUCTION_STAFF_SHUFFLED,
  staffAt,
} from "@/lib/credits/CreditsStaffNames";

const CARL = "Carl Fearby";

const SCROLL_SPEED = 95;
const INTRO_DELAY_S = 2;
const SCROLL_FAST_FACTOR = 0.14;
const THE_END_HOLD_MS = 5000;
const THANK_YOU_MS = 3000;
/** Pause once THE END has scrolled this far above viewport center (visual centering). */
const THE_END_CENTER_BIAS_PX = 36;

/** Per-track soundtrack credits — tongue firmly in cheek. */
const TRACK_SONG_CREDITS = Object.freeze({
  "galactic-drifter": [
    ["Official Mood", "Staring At A Progress Bar"],
    ["Written during", "npm install (still running)"],
    ["Tempo", "Slower Than Your Download"],
    ["Key", "Waiting Minor"],
    ["Time Signature", "4/4 Until The Bar Stops"],
    ["Inspired by", "The spinning VX-27 logo"],
    ["Lyrics", "None (Carl was busy loading)"],
    ["Composed by", "Fay Brace"],
    ["Arranged by", "Clay Faber"],
    ["Programmed by", "Ray Cable"],
    ["Mixed by", "Alf Bracey"],
    ["Mastered by", "Earl Farby"],
    ["Mixer Notes", "More reverb than progress"],
    ["Plays When", "Carl tests 'one more thing'"],
    ["Grammy Category", "Best Loading Screen Anthem"],
    ["Streaming Revenue", "Paid in exposure"],
    ["Vocals", "Carl Fearby (mumbling 'almost there')"],
    ["Executive Producer", CARL],
    ["Published by", `${CARL} Productions`],
    ["Rights", "All rites reserved for the loading cult"],
  ],
  "galactic-drifter-2": [
    ["Subtitle", "The Driftening Continues"],
    ["Sequel Because", "Carl had one more MIDI file"],
    ["Features", "47% More Galactic, 12% More Drift"],
    ["Written by", "Cyra Fable"],
    ["Produced by", "Cary Baler"],
    ["Composed while", "Carl walked into pillars repeatedly"],
    ["Combat Mix", "Duck under gunfire (unimplemented)"],
    ["Loop Length", "Long enough to forget which room"],
    ["BPM", "Exactly one sprint per bar"],
    ["Player Feedback", "'Can we skip this?' — Carl, playtesting"],
    ["Licensed for", "Indoor arena violence only"],
    ["Not Licensed for", "Actual galactic drifting"],
    ["Co-Produced by", "Ralf Bayer"],
    ["Performed by", "The Carl Fearby Anagram Players"],
    ["All Instruments", "A laptop and hope"],
    ["Soundcheck", "Passed (Carl was the only listener)"],
    ["Vocals", "Carl Fearby (uncredited, again)"],
    ["Executive Music Producer", CARL],
    ["Published by", `${CARL} Productions`],
    ["In Memoriam", "Your ears, briefly"],
  ],
});

function trackUsageLabel(trackId) {
  if (trackId === DEFAULT_LOADING_TRACK_ID) return "Loading Screen Theme";
  if (trackId === DEFAULT_LEVEL_TRACK_ID) return "In-Game Theme";
  return "Original Soundtrack";
}

function trackTagline(trackId) {
  if (trackId === DEFAULT_LOADING_TRACK_ID) {
    return "The anthem of patience. Side effects may include checking the router.";
  }
  if (trackId === DEFAULT_LEVEL_TRACK_ID) {
    return "Now with 100% more gameplay. Carl insists you will feel the drift.";
  }
  return "A Carl Fearby joint. No refunds on vibes.";
}

const SECTIONS = [
  {
    title: "Production",
    credits: [
      ["Executive Producer", GOLD_STAFF[0]],
      ["Producer", GOLD_STAFF[1]],
      ["Line Producer", GOLD_STAFF[2]],
      ["Unit Production Manager", GOLD_STAFF[3]],
      ["Production Coordinator", GOLD_STAFF[4]],
      ["Production Accountant", GOLD_STAFF[5]],
      ["Studio Head", CARL],
    ],
  },
  {
    title: "Direction & Creative",
    credits: [
      ["Game Director", GOLD_STAFF[7]],
      ["Creative Director", GOLD_STAFF[11]],
      ["Art Director", GOLD_STAFF[8]],
      ["Technical Director", staffAt(12)],
      ["Cinematic Director", staffAt(13)],
      ["Vision Holder", staffAt(14)],
      ["Final Say Enforcer", CARL],
    ],
  },
  {
    title: "Engine & Rendering",
    credits: [
      ["Lead Engine Programmer", GOLD_STAFF[3]],
      ["Render Pipeline Architect", staffAt(15)],
      ["WebGL Wrangler", GOLD_STAFF[0]],
      ["Shader Artist", staffAt(16)],
      ["Post-Processing Supervisor", staffAt(17)],
      ["GPU Preload Coordinator", staffAt(18)],
      ["Marketing Sparkle Division", staffAt(124)],
      ["Frame Budget Negotiator", staffAt(19)],
      ["WebP Texture Migration Lead", staffAt(20)],
      ["Container WebP Batch Converter", staffAt(121)],
      ["Room Light Culling Engineer", staffAt(122)],
      ["Shadow Map Churn Therapist", staffAt(123)],
      ["Sky Dome Seamless Stitcher", staffAt(21)],
    ],
  },
  {
    title: "Gameplay Systems",
    credits: [
      ["Lead Gameplay Programmer", staffAt(22)],
      ["Player Controller Engineer", staffAt(23)],
      ["Collision Detection Specialist", staffAt(24)],
      ["Weapon Systems Programmer", staffAt(25)],
      ["Grenade Trajectory Mathematician", staffAt(26)],
      ["Target Systems Engineer", staffAt(27)],
      ["Doorway Wall Technician", staffAt(28)],
    ],
  },
  {
    title: "Level Design & World",
    credits: [
      ["Lead Level Designer", staffAt(29)],
      ["Arena Architect", staffAt(30)],
      ["Stair Ramp Designer", staffAt(31)],
      ["Pillar Geometry Curator", staffAt(32)],
      ["Room Culling Optimization Expert", staffAt(33)],
      ["Level Texture Painter", staffAt(34)],
      ['"Is this room too big?" Analyst', staffAt(35)],
    ],
  },
  {
    title: "Lighting & Atmosphere",
    credits: [
      ["Lighting Director", staffAt(36)],
      ["Sun Light Tuning Engineer", staffAt(37)],
      ["Moon Light Calibration Specialist", staffAt(38)],
      ["Hemisphere Lighting Artist", staffAt(39)],
      ["Candle Flicker Animator", GOLD_STAFF[6]],
      ["Shadow Quality Perfectionist", staffAt(40)],
    ],
  },
  {
    title: "Visual Effects & Combat Feedback",
    credits: [
      ["VFX Supervisor", GOLD_STAFF[9]],
      ["Blood Particle Effects Artist", staffAt(41)],
      ["Bullet Hole Decal Specialist", staffAt(42)],
      ["Container Door Decal Lead", staffAt(118)],
      ["Screen Shake Authority", staffAt(43)],
      ["Juice Engineer", staffAt(44)],
      ["Satisfying Hit Marker Consultant", staffAt(45)],
    ],
  },
  {
    title: "Environmental Hazards",
    credits: [
      ["Oil Barrel Systems Lead", GOLD_STAFF[4]],
      ["Interior Flame Video Artist", staffAt(46)],
      ["Barrel Fire Light Designer", staffAt(47)],
      ["Organic Pile Layout Engineer", staffAt(48)],
      ["Barrel Interior Texture Painter", staffAt(49)],
      ["Open-Top Explosion Coordinator", staffAt(50)],
      ["Flammable Prop Safety Officer (Unpaid)", staffAt(51)],
      ["Room Render Layer Fixer", staffAt(52)],
      ["Pile Hub Rotation Specialist", staffAt(107)],
    ],
  },
  {
    title: "VX-27 Cargo Systems",
    credits: [
      ["Cargo Module Art Director", staffAt(108)],
      ["Corrugated Shell Texture Lead", staffAt(109)],
      ["Rounded Roof/Floor Engineer", staffAt(110)],
      ["Door Leaf Animation Programmer", staffAt(111)],
      ["E-Key Interact Prompt Writer", staffAt(112)],
      ["End-Cap Bullet Passthrough Architect", staffAt(113)],
      ["Interior Liner Decal Specialist", staffAt(114)],
      ["Container Collider Debug Wrangler", staffAt(115)],
      ["Roof/Floor Cap UV Alignment Specialist", staffAt(124)],
      ["Door Depth Offset Slider Engineer", staffAt(125)],
      ["Fire Video Upload Gatekeeper", staffAt(126)],
    ],
  },
  {
    title: "Character & Animation",
    credits: [
      ["Lead Animator", GOLD_STAFF[5]],
      ["Walk Bob Tuning Specialist", staffAt(53)],
      ["Stair Walk Physics Consultant", staffAt(54)],
      ["Head Bob Frequency Analyst", staffAt(55)],
      ["Motion Sickness Prevention Officer", staffAt(56)],
      ["First-Person Presence Director", staffAt(57)],
    ],
  },
  {
    title: "Audio",
    credits: [
      ["Audio Director", staffAt(58)],
      ["Sound Designer", staffAt(59)],
      ["Lead Composer", staffAt(60)],
      ["Foley Artist", GOLD_STAFF[10]],
      ["Gunshot Recording Engineer", staffAt(61)],
      ["Volume Slider Guardian", staffAt(62)],
      ["Oil Barrel Fire Loop Composer", staffAt(63)],
    ],
  },
  {
    title: "User Interface & HUD",
    credits: [
      ["UI/UX Director", staffAt(64)],
      ["HUD Bar Designer", staffAt(65)],
      ["Compass Overlay Artist", staffAt(66)],
      ["Controls Panel Architect", staffAt(67)],
      ["Loading Screen Art Director", staffAt(68)],
      ["Orbitron Font Enthusiast", staffAt(69)],
    ],
  },
  {
    title: "Dev Tools & Tuning Panels",
    credits: [
      ["Dev Tools Czar", staffAt(70)],
      ["Weapon Tune Panel Engineer", staffAt(71)],
      ["Stair Tune Panel Engineer", staffAt(72)],
      ["Sun Tune Panel Engineer", staffAt(73)],
      ["Oil Barrel Tune Panel Engineer", staffAt(74)],
      ["VX-27 Container Tune Panel Engineer", staffAt(117)],
      ["Pile Hub Placement Wizard", staffAt(116)],
      ["Sliders For Everything Advocate", staffAt(75)],
      ["Live Tweak Enjoyer", staffAt(76)],
      ["Localhost Tune Panel Restorer", staffAt(127)],
      ["HUD Position Tune Opt-In Advocate", staffAt(128)],
    ],
  },
  {
    title: "Quality Assurance",
    credits: [
      ["QA Lead", GOLD_STAFF[2]],
      ["Senior QA Tester", staffAt(77)],
      ["Playtest Coordinator", staffAt(78)],
      ["Bug Finder", staffAt(79)],
      ["Stuck In Geometry Investigator", staffAt(80)],
      ['"Works On My Machine" Certifier', staffAt(81)],
    ],
  },
  {
    title: "Technical Operations",
    credits: [
      ["Build Engineer", staffAt(82)],
      ["Next.js Configuration Specialist", staffAt(83)],
      ["Hot Reload Survivor", staffAt(84)],
      ["Git Commit Message Poet", staffAt(85)],
      ["Marketing Site Refresh Lead", staffAt(120)],
      ["Merge Conflict Resolver", staffAt(86)],
      ["Force Push Avoider (Mostly)", staffAt(87)],
    ],
  },
  {
    title: "Cast",
    credits: [
      ["The Player", staffAt(88)],
      ["Every Enemy Target", staffAt(89)],
      ["The Gun", staffAt(90)],
      ["The Grenade", staffAt(91)],
      ["The Stairs", staffAt(92)],
      ["The Pillar (Scene Stealer)", staffAt(93)],
      ["The Oil Barrel (Scene Stealer #2)", staffAt(94)],
      ["The Barrel Pile", staffAt(95)],
      ["The VX-27 Cargo Module", staffAt(119)],
      ["Carl Fearby", "As Himself"],
    ],
  },
  {
    title: "Stunts & Practical Effects",
    credits: [
      ["Stunt Coordinator", GOLD_STAFF[1]],
      ["Grenade Throw Double", staffAt(96)],
      ["Wall Clip Stunt Performer", staffAt(97)],
      ["Blood Splatter Coordinator", staffAt(98)],
    ],
  },
  {
    title: "Catering & Wellness",
    credits: [
      ["Craft Services", staffAt(99)],
      ["Coffee Machine Operator", staffAt(100)],
      ["Energy Drink Procurement", staffAt(101)],
      ["Midnight Snack Coordinator", staffAt(102)],
      ["Sleep Deprivation Manager", staffAt(103)],
    ],
  },
  {
    title: "Special Thanks",
    credits: [
      ["Three.js", "For existing"],
      ["React", "For re-rendering"],
      ["Next.js", "For the router (finally)"],
      ["WebGL", "For not crashing (usually)"],
      ["WebP", "For the bandwidth Carl finally noticed"],
      ["FFmpeg", "For the barrel flames"],
      ["The Anagram Department", "For plausible deniability"],
      ["60 FPS", "When Carl allows it"],
      ["Stack Overflow", "Carl's co-pilot"],
      ["Future Carl", "Good luck"],
      ["Past Carl", "Sorry about the tech debt"],
    ],
  },
  {
    title: "Legal & Compliance",
    credits: [
      ["General Counsel", GOLD_STAFF[11]],
      ["Intellectual Property Owner", staffAt(104)],
      ["Copyright Holder", staffAt(105)],
      ["Trademark Applicant", staffAt(106)],
      ["NDA Signatory (Self)", CARL],
    ],
  },
];

const ASSETS = {
  grenade: { src: "/ui/grenade.webp" },
  powepack: { src: "/ui/powepack.webp" },
  stamina: { src: "/ui/stamina-icon.webp" },
  "second-weapon": { src: "/ui/second-weapon.webp" },
  radar: { src: "/ui/radar_hud.webp" },
  "crate-front": { src: "/ui/crate/front.webp" },
  "crate-top": { src: "/ui/crate/top.webp" },
  "crate-end": { src: "/ui/crate/endcap.png" },
  vx27: { src: "/textures/vx27/vx27_body_albedo.webp" },
  "grenade-tex": { src: "/textures/grenade/grenade_reward_texture_pack_preview.png" },
  moon: { src: "/sky/moon_full.jpg" },
  hazard: {
    src: "/textures/decal_hazard_stripes_worn/decal_hazard_stripes_worn_albedo_tileable.webp",
  },
  "bullet-1": { src: "/textures/bullet_holes/01_concrete_bullet_hole_alpha.webp" },
  "bullet-2": { src: "/textures/bullet_holes/02_concrete_bullet_hole_alpha.webp" },
  "bullet-3": { src: "/textures/bullet_holes/03_concrete_bullet_hole_alpha.webp" },
  "bullet-4": { src: "/textures/bullet_holes/04_concrete_bullet_hole_alpha.webp" },
  "bullet-5": { src: "/textures/bullet_holes/05_concrete_bullet_hole_alpha.webp" },
  "oil-barrel": { src: "/textures/oil_barrel/barrel_body_albedo.webp" },
  "sky-dome": { src: "/sky/sky_dome_equirectangular_4k.webp" },
};

/** Prop art sprinkled between credit sections — keyed by section title. */
const PROPS_AFTER = {
  Production: { layout: "scatter", items: ["grenade", "powepack", "stamina"] },
  "Direction & Creative": { layout: "solo", item: "radar", caption: "Tactical Overlay" },
  "Engine & Rendering": { layout: "rifle", caption: "VX-27 Rifle" },
  "Gameplay Systems": { layout: "ammo-crate" },
  "Level Design & World": { layout: "solo", item: "second-weapon", caption: "Standard Issue" },
  "Lighting & Atmosphere": { layout: "moon" },
  "Visual Effects & Combat Feedback": { layout: "bullet-wall" },
  "Environmental Hazards": { layout: "duo", items: ["oil-barrel", "hazard"], caption: "Handle With Care" },
  "VX-27 Cargo Systems": { layout: "vx27-container", caption: "VX-27 Cargo Module" },
  "Character & Animation": { layout: "solo", item: "stamina", caption: "Walk Power", spin: true },
  Audio: { layout: "duo", items: ["powepack", "grenade"], caption: "Soundtrack Fuel" },
  "User Interface & HUD": { layout: "hud-row", items: ["second-weapon", "radar", "stamina"] },
  "Dev Tools & Tuning Panels": { layout: "hazard" },
  "Quality Assurance": { layout: "scatter", items: ["crate-front", "grenade", "bullet-1"] },
  "Technical Operations": { layout: "solo", item: "radar", caption: "Systems Online" },
  Cast: { layout: "cluster" },
  "Stunts & Practical Effects": { layout: "duo", items: ["grenade", "powepack"] },
  "Catering & Wellness": { layout: "solo", item: "powepack", caption: "Craft Services" },
  "Special Thanks": { layout: "scatter", items: ["crate-front", "grenade", "powepack", "stamina"] },
  "Legal & Compliance": { layout: "texture-strip", art: "grenade-tex", caption: "Exhibit A" },
};

const SECTION_LAYOUTS = {
  Production: { align: "center", cols: 1 },
  "Direction & Creative": { align: "center", cols: 1, flank: "rifle", flankSide: "left" },
  "Engine & Rendering": { align: "center", cols: 1, flank: "bullet-cluster", flankSide: "right" },
  "Gameplay Systems": { align: "center", cols: 1 },
  "Level Design & World": { align: "center", cols: 1, flank: "hazard", flankSide: "left" },
  "Lighting & Atmosphere": { align: "center", cols: 1, flank: "moon", flankSide: "right" },
  "Visual Effects & Combat Feedback": { align: "center", cols: 1 },
  "Environmental Hazards": { align: "center", cols: 1, flank: "oil-barrel", flankSide: "right" },
  "VX-27 Cargo Systems": { align: "center", cols: 1, flank: "vx27-container", flankSide: "left" },
  "Character & Animation": { align: "center", cols: 1 },
  Audio: { align: "center", cols: 1 },
  "User Interface & HUD": { align: "center", cols: 1 },
  "Dev Tools & Tuning Panels": { align: "center", cols: 1, flank: "grenade-tex", flankSide: "left" },
  "Quality Assurance": { align: "center", cols: 1 },
  "Technical Operations": { align: "center", cols: 1 },
  Cast: { align: "center", cols: 1 },
  "Stunts & Practical Effects": { align: "center", cols: 1, flank: "bullet-cluster", flankSide: "right" },
  "Catering & Wellness": { align: "center", cols: 1 },
  "Special Thanks": { align: "center", cols: 1 },
  "Legal & Compliance": { align: "center", cols: 1 },
};

const INTERSTITIAL_CYCLE = [
  "drift-grenade-r",
  "drift-crate-l",
  "art-moon",
  "art-hazard",
  "drift-stamina-l",
  "art-vx27",
  "art-container",
  "drift-powepack-r",
  "art-grenade-tex",
  "drift-radar",
  "art-bullet-wall",
  "art-oil-barrel",
];

function SectionRule({ align = "center" }) {
  return (
    <div className={`creditsSectionRule creditsSectionRule--${align}`} aria-hidden>
      <span className="creditsSectionRuleLine" />
      <span className="creditsSectionRuleDot" />
      <span className="creditsSectionRuleLine" />
    </div>
  );
}

function ProductionStaffSection() {
  return (
    <section className="creditsSection creditsSection--center creditsProductionStaff">
      <h2 className="creditsSectionTitle">Production Staff</h2>
      <SectionRule align="center" />
      <p className="creditsProductionStaffLead">
        The following {PRODUCTION_STAFF.length} personnel contributed to this production.
        <br />
        Any resemblance to real developers is purely alphabetical.
      </p>
      <div className="creditsProductionStaffGrid">
        {PRODUCTION_STAFF_SHUFFLED.map((name) => (
          <div key={name} className="creditsProductionStaffName">
            {name}
          </div>
        ))}
      </div>
      <p className="creditsProductionStaffFine">
        …and literally nobody else. (It&apos;s still Carl.)
      </p>
    </section>
  );
}

function AnagramReveal() {
  return (
    <div className="creditsReveal" aria-label="Credits twist reveal">
      <p className="creditsRevealEyebrow">A Carl Fearby Production · Final Footnote</p>
      <h2 className="creditsRevealTitle">IT&apos;S ALL CARL</h2>
      <p className="creditsRevealSubtitle">THESE WERE ALL ANAGRAMS</p>
      <div className="creditsRevealDivider" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p className="creditsRevealBody">
        {GOLD_STAFF.slice(0, 6).join(" · ")}
        <br />
        {GOLD_STAFF.slice(6).join(" · ")}
        <br />
        …plus {PRODUCTION_STAFF.length - GOLD_STAFF.length} others you definitely read every single one of.
      </p>
      <p className="creditsRevealSpell">
        Unscramble the staff. It&apos;s always been{" "}
        <span className="creditsRevealCarl">{CARL}</span>.
      </p>
      <p className="creditsRevealTag">No additional crew were harmed in the making of this credit roll.</p>
    </div>
  );
}

function CreditBlock({ role, name, highlight }) {
  return (
    <div className={`creditsBlock${highlight ? " creditsBlock--highlight" : ""}`}>
      <div className="creditsRole">{role}</div>
      <div className={`creditsName${highlight ? " gold" : ""}`}>{name}</div>
    </div>
  );
}

function CreditsAsset({ id, className = "" }) {
  const asset = ASSETS[id];
  if (!asset) return null;
  return (
    <img
      src={asset.src}
      alt=""
      className={`creditsPropImg creditsAsset creditsAsset--${id}${className ? ` ${className}` : ""}`}
      draggable={false}
    />
  );
}

function CreditsFlankArt({ art, side }) {
  if (!art) return null;
  if (art === "rifle") {
    return (
      <div className={`creditsFlank creditsFlank--${side}`} aria-hidden>
        <CreditsRiflePreview variant="flank" />
      </div>
    );
  }
  if (art === "vx27-container") {
    return (
      <div className={`creditsFlank creditsFlank--${side}`} aria-hidden>
        <CreditsVx27ContainerPreview variant="flank" />
      </div>
    );
  }
  return (
    <div className={`creditsFlank creditsFlank--${side}`} aria-hidden>
      {art === "bullet-cluster" ? (
        <div className="creditsFlankBulletCluster">
          <CreditsAsset id="bullet-1" className="creditsFlankBullet creditsFlankBullet--a" />
          <CreditsAsset id="bullet-3" className="creditsFlankBullet creditsFlankBullet--b" />
          <CreditsAsset id="bullet-5" className="creditsFlankBullet creditsFlankBullet--c" />
        </div>
      ) : (
        <CreditsAsset id={art} className="creditsFlankImg" />
      )}
    </div>
  );
}

function CreditsInterstitial({ kind }) {
  if (!kind) return null;

  if (kind.startsWith("drift-")) {
    const parts = kind.split("-");
    const side = parts.length > 2 ? parts[parts.length - 1] : "l";
    const asset = parts.length > 2 ? parts.slice(1, -1).join("-") : parts[1];
    const id = asset === "crate" ? "crate-front" : asset;
    return (
      <div className={`creditsDrift creditsDrift--${side}`} aria-hidden>
        <CreditsAsset id={id} />
      </div>
    );
  }

  if (kind === "art-moon") {
    return (
      <div className="creditsInterstitial creditsInterstitial--moon" aria-hidden>
        <CreditsAsset id="moon" className="creditsMoonDisc" />
      </div>
    );
  }

  if (kind === "art-hazard") {
    return (
      <div className="creditsInterstitial creditsInterstitial--hazard" aria-hidden>
        <CreditsAsset id="hazard" className="creditsHazardStrip" />
      </div>
    );
  }

  if (kind === "art-vx27") {
    return (
      <div className="creditsInterstitial creditsInterstitial--vx27" aria-hidden>
        <CreditsRiflePreview variant="hero" />
        <p className="creditsPropCaption">VX-27 Rifle</p>
      </div>
    );
  }

  if (kind === "art-container") {
    return (
      <div className="creditsInterstitial creditsInterstitial--container" aria-hidden>
        <CreditsVx27ContainerPreview variant="hero" />
        <p className="creditsPropCaption">VX-27 Cargo Module</p>
      </div>
    );
  }

  if (kind === "art-grenade-tex") {
    return (
      <div className="creditsInterstitial creditsInterstitial--grenadeTex" aria-hidden>
        <CreditsAsset id="grenade-tex" className="creditsGrenadeStrip" />
      </div>
    );
  }

  if (kind === "art-bullet-wall") {
    return (
      <div className="creditsInterstitial creditsInterstitial--bulletWall" aria-hidden>
        <CreditsAsset id="bullet-1" className="creditsBulletWallItem creditsBulletWallItem--0" />
        <CreditsAsset id="bullet-2" className="creditsBulletWallItem creditsBulletWallItem--1" />
        <CreditsAsset id="bullet-4" className="creditsBulletWallItem creditsBulletWallItem--2" />
        <CreditsAsset id="bullet-5" className="creditsBulletWallItem creditsBulletWallItem--3" />
      </div>
    );
  }

  if (kind === "art-oil-barrel") {
    return (
      <div className="creditsInterstitial creditsInterstitial--oilBarrel" aria-hidden>
        <CreditsAsset id="oil-barrel" className="creditsOilBarrelDisc" />
        <p className="creditsPropCaption">Highly Flammable · Do Not Shoot</p>
      </div>
    );
  }

  return null;
}

function CreditsDrift({ kind }) {
  return <CreditsInterstitial kind={kind} />;
}

function CreditSection({ title, credits }) {
  const layout = SECTION_LAYOUTS[title] ?? { align: "center", cols: 1 };
  const { align, cols, flank, flankSide } = layout;

  return (
    <div className="creditsSectionWrap">
      {flank ? <CreditsFlankArt art={flank} side={flankSide ?? "left"} /> : null}
      <section className={`creditsSection creditsSection--${align} creditsSection--cols${cols}`}>
        <h2 className="creditsSectionTitle">{title}</h2>
        <SectionRule align={align} />
        <div className="creditsSectionBody">
          {credits.map(([role, name], i) => (
            <CreditBlock key={`${title}-${i}`} role={role} name={name} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CreditsEqualizer({ bars = 12 }) {
  return (
    <div className="creditsEq" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="creditsEqBar" style={{ "--eq-i": i }} />
      ))}
    </div>
  );
}

function SongsSection() {
  return (
    <div className="creditsSectionWrap creditsSectionWrap--songs">
      <CreditsFlankArt art="moon" side="right" />
      <div className="creditsSongsAura" aria-hidden />
      <section className="creditsSection creditsSection--center creditsSection--songs">
        <h2 className="creditsSectionTitle creditsSectionTitle--glitch" data-text="Songs">
          Songs
        </h2>
        <SectionRule align="center" />
        <p className="creditsSongsLead">
          Original compositions. Any resemblance to professional music is coincidental and
          legally inconvenient.
        </p>
        {MUSIC_TRACKS.map((track, index) => {
          const credits = TRACK_SONG_CREDITS[track.id] ?? TRACK_SONG_CREDITS[DEFAULT_LOADING_TRACK_ID];
          return (
            <div
              key={track.id}
              className={`creditsSong creditsSong--${index % 2 === 0 ? "a" : "b"}`}
            >
              <CreditsEqualizer />
              <svg
                className="creditsSongIcon"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M9 18V5l12-2v13"
                  stroke="#5eaaff"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="6" cy="18" r="3" fill="rgba(94,170,255,0.35)" stroke="#5eaaff" strokeWidth="1.5" />
                <circle cx="18" cy="16" r="3" fill="rgba(94,170,255,0.35)" stroke="#5eaaff" strokeWidth="1.5" />
              </svg>
              <h3 className="creditsSongTitle">{track.label}</h3>
              <p className="creditsSongUsage">{trackUsageLabel(track.id)}</p>
              <p className="creditsSongTagline">{trackTagline(track.id)}</p>
              <div className="creditsSongCredits">
                {credits.map(([role, name]) => (
                  <CreditBlock key={`${track.id}-${role}`} role={role} name={name} />
                ))}
              </div>
              {index < MUSIC_TRACKS.length - 1 ? (
                <div className="creditsSongDivider" aria-hidden />
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function CreditsDecor({ scanlineActive }) {
  return (
    <>
      <div className="creditsGrid" aria-hidden />
      <CreditsScanlineCanvas active={scanlineActive} />
      <div className="creditsCornerBrackets" aria-hidden />
    </>
  );
}

function CreditsPropImg({ id, className = "" }) {
  return <CreditsAsset id={id} className={className} />;
}

function CreditsAmmoCrate({ variant = "default" }) {
  return <CreditsAmmoCratePreview variant={variant} />;
}

function CreditsVx27Container({ variant = "default" }) {
  return <CreditsVx27ContainerPreview variant={variant} />;
}

function CreditsPropInsert({ layout, items, item, caption, spin, art }) {
  return (
    <div className="creditsPropInsert" aria-hidden>
      {caption ? <p className="creditsPropCaption">{caption}</p> : null}

      {layout === "moon" ? (
        <div className="creditsInterstitial creditsInterstitial--moon creditsInterstitial--inline">
          <CreditsAsset id="moon" className="creditsMoonDisc" />
          <p className="creditsPropCaption">Lunar Calibration Reference</p>
        </div>
      ) : null}

      {layout === "hazard" ? (
        <div className="creditsInterstitial creditsInterstitial--hazard creditsInterstitial--inline">
          <CreditsAsset id="hazard" className="creditsHazardStrip" />
        </div>
      ) : null}

      {layout === "bullet-wall" ? (
        <CreditsInterstitial kind="art-bullet-wall" />
      ) : null}

      {layout === "texture-strip" ? (
        <div className="creditsInterstitial creditsInterstitial--texture creditsInterstitial--inline">
          {art === "vx27" || art === "rifle" ? (
            <CreditsRiflePreview variant="strip" />
          ) : (
            <CreditsAsset id={art} className="creditsTextureStrip" />
          )}
        </div>
      ) : null}

      {layout === "rifle" ? (
        <div className="creditsInterstitial creditsInterstitial--vx27 creditsInterstitial--inline">
          <CreditsRiflePreview variant="hero" />
          {caption ? <p className="creditsPropCaption">{caption}</p> : null}
        </div>
      ) : null}

      {layout === "ammo-crate" ? (
        <>
          <CreditsAmmoCrate />
          <p className="creditsPropCaption">Ammo Resupply Unit</p>
        </>
      ) : null}

      {layout === "vx27-container" ? (
        <>
          <CreditsVx27Container variant="hero" />
          {caption ? <p className="creditsPropCaption">{caption}</p> : null}
        </>
      ) : null}

      {layout === "solo" ? (
        <div className={`creditsPropSolo${spin ? " creditsPropSolo--spin" : ""}`}>
          <CreditsPropImg id={item} />
        </div>
      ) : null}

      {layout === "duo" ? (
        <div className="creditsPropDuo">
          {items?.map((id, i) => (
            <CreditsPropImg key={id} id={id} className={i === 0 ? "creditsPropDuoLeft" : "creditsPropDuoRight"} />
          ))}
        </div>
      ) : null}

      {layout === "hud-row" ? (
        <div className="creditsPropHudRow">
          {items?.map((id) => (
            <div key={id} className={`creditsPropHudCell creditsPropHudCell--${id}`}>
              <CreditsPropImg id={id} />
            </div>
          ))}
        </div>
      ) : null}

      {layout === "scatter" ? (
        <div className="creditsPropScatter">
          {items?.map((id, i) => (
            <CreditsPropImg
              key={`${id}-${i}`}
              id={id}
              className={`creditsPropScatterItem creditsPropScatterItem--${i}`}
            />
          ))}
        </div>
      ) : null}

      {layout === "cluster" ? (
        <div className="creditsPropCluster">
          <CreditsAmmoCrate variant="cluster" />
          <CreditsPropImg id="grenade" className="creditsPropClusterGrenade" />
          <CreditsPropImg id="powepack" className="creditsPropClusterPowepack" />
          <CreditsPropImg id="stamina" className="creditsPropClusterStamina" />
          <div className="creditsPropClusterHud">
            <CreditsPropImg id="second-weapon" />
          </div>
        </div>
      ) : null}

      {layout === "finale-row" ? (
        <>
          <p className="creditsPropCaption">The Whole Arsenal</p>
          <div className="creditsPropFinaleRow">
            <CreditsPropImg id="grenade" className="creditsPropFinaleItem creditsPropFinaleItem--0" />
            <CreditsPropImg id="crate-front" className="creditsPropFinaleItem creditsPropFinaleItem--1" />
            <CreditsPropImg id="powepack" className="creditsPropFinaleItem creditsPropFinaleItem--2" />
            <CreditsPropImg id="stamina" className="creditsPropFinaleItem creditsPropFinaleItem--3" />
            <CreditsPropImg id="second-weapon" className="creditsPropFinaleItem creditsPropFinaleItem--4" />
          </div>
        </>
      ) : null}
    </div>
  );
}

function CreditsThankYou() {
  return (
    <div className="creditsThankYou" aria-live="polite">
      <p className="creditsThankYouText">Thank You</p>
    </div>
  );
}

function CreditsTrackPlayer({ soundsRef, activeTrackId, onTrackSelect, onClose }) {
  return (
    <div
      className="creditsTrackPlayer"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="creditsTrackPlayerInner" onClick={(e) => e.stopPropagation()}>
        <div className="creditsTrackPlayerViz" aria-hidden>
          <LoadingAudioViz
            showToggle={false}
            getAnalyser={() => soundsRef.current?.getLoadingAnalyser()}
            getBeatAnalyser={() => soundsRef.current?.getLoadingBeatAnalyser()}
            isMusicPreloaded={() => soundsRef.current?.isMusicPreloaded()}
            isLoadingMusicPlaying={() => soundsRef.current?.isLoadingMusicPlaying()}
            resetKey={activeTrackId}
          />
        </div>
        <div className="creditsTrackPlayerPanel">
          <p className="creditsTrackPlayerLabel">Soundtrack</p>
          <p className="creditsTrackPlayerDismiss">Click outside · M · or Esc to close</p>
          <ul className="creditsTrackList">
            {MUSIC_TRACKS.map((track) => (
              <li key={track.id}>
                <button
                  type="button"
                  className={`creditsTrackBtn${activeTrackId === track.id ? " creditsTrackBtn--active" : ""}`}
                  onClick={() => onTrackSelect(track.id)}
                  aria-current={activeTrackId === track.id ? "true" : undefined}
                >
                  <span className="creditsTrackBtnLabel">{track.label}</span>
                  <span className="creditsTrackBtnMeta">{trackUsageLabel(track.id)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function CreditsScene() {
  const scrollRef = useRef(null);
  const soundsRef = useRef(null);
  const preEndMarkerRef = useRef(null);
  const theEndTitleRef = useRef(null);
  const preEndProgressRef = useRef(0.88);
  const endSequenceStartedRef = useRef(false);
  const holdTimerRef = useRef(0);
  const thankYouTimerRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const fastRef = useRef(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [endPhase, setEndPhase] = useState("scrolling");
  const [activeTrackId, setActiveTrackId] = useState(DEFAULT_LOADING_TRACK_ID);

  useEffect(() => {
    setActiveTrackId(loadStoredLoadingTrackId());
  }, []);

  useEffect(() => {
    fastRef.current = fast;
  }, [fast]);

  useEffect(() => {
    setCreditsPreviewPaused(paused || endPhase !== "scrolling");
  }, [paused, endPhase]);

  useEffect(() => {
    preloadCreditsAssets().catch(() => {});
  }, []);

  useEffect(() => {
    const camera = new THREE.PerspectiveCamera();
    const sounds = createSoundManager(camera);
    soundsRef.current = sounds;

    let cancelled = false;
    sounds.preload().then(() => {
      if (cancelled) return;
      sounds.resume();
      sounds.startLoadingMusic({ trackId: loadStoredLoadingTrackId() });
    });

    return () => {
      cancelled = true;
      sounds.dispose();
      soundsRef.current = null;
    };
  }, []);

  const ensureLoadingMusic = useCallback(() => {
    const s = soundsRef.current;
    if (!s) return;
    s.resume();
    if (!s.isLoadingMusicPlaying()) {
      s.startLoadingMusic({ trackId: activeTrackId });
    }
  }, [activeTrackId]);

  const handleTrackSelect = useCallback((trackId) => {
    setActiveTrackId(trackId);
    localStorage.setItem(MUSIC_TRACK_KEY, trackId);
    const s = soundsRef.current;
    if (!s) return;
    s.resume();
    s.setLoadingTrack(trackId);
    if (!s.isLoadingMusicPlaying()) {
      s.startLoadingMusic({ trackId });
    }
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollStartedRef = { current: false };
    let startTimer = 0;
    let cancelled = false;

    const applyMeasure = () => {
      const viewport = el.parentElement?.offsetHeight ?? window.innerHeight;
      const distance = el.offsetHeight + viewport;
      const duration = distance / SCROLL_SPEED;
      el.style.setProperty("--credits-duration", `${duration}s`);
      el.style.setProperty("--credits-delay", `${INTRO_DELAY_S}s`);
    };

    const scheduleStart = () => {
      if (scrollStartedRef.current || cancelled) return;
      clearTimeout(startTimer);
      startTimer = window.setTimeout(() => {
        if (scrollStartedRef.current || cancelled) return;
        scrollStartedRef.current = true;
        setReady(true);
      }, 120);
    };

    applyMeasure();
    scheduleStart();

    const ro = new ResizeObserver(() => {
      if (scrollStartedRef.current) return;
      applyMeasure();
      scheduleStart();
    });
    ro.observe(el);

    const onResize = () => {
      if (scrollStartedRef.current) return;
      applyMeasure();
      scheduleStart();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), 9000);
    return () => clearTimeout(timer);
  }, []);

  const measurePreEndProgress = useCallback(() => {
    const el = scrollRef.current;
    const marker = preEndMarkerRef.current;
    const viewport = el?.parentElement;
    if (!el || !marker || !viewport) return;

    const viewH = viewport.clientHeight;
    const scrollH = el.offsetHeight;
    const yStart = viewH;
    const yEnd = -scrollH;
    const savedAnimation = el.style.animation;
    const savedTransform = el.style.transform;

    el.style.animation = "none";
    let best = 0.88;

    for (let i = 0; i <= 48; i++) {
      const p = i / 48;
      const y = yStart + (yEnd - yStart) * p;
      el.style.transform = `translate3d(-50%, ${y}px, 0)`;
      const markerBottom = marker.getBoundingClientRect().bottom;
      const viewBottom = viewport.getBoundingClientRect().bottom;
      if (markerBottom <= viewBottom + 16) {
        best = Math.max(0, p - 0.025);
        break;
      }
    }

    preEndProgressRef.current = best;
    el.style.animation = savedAnimation;
    el.style.transform = savedTransform;
  }, []);

  const getBaseScrollDurationSec = useCallback((el) => {
    return parseFloat(getComputedStyle(el).getPropertyValue("--credits-duration")) || 480;
  }, []);

  const getScrollDurationSec = useCallback(
    (el, useFast = fastRef.current) => {
      const base = getBaseScrollDurationSec(el);
      return useFast ? base * SCROLL_FAST_FACTOR : base;
    },
    [getBaseScrollDurationSec],
  );

  const readScrollProgress = useCallback((el) => {
    const anim = el.getAnimations().find((a) => a.animationName === "creditsRise");
    if (!anim?.effect) return 0;
    const timing = anim.effect.getComputedTiming();
    const delay = typeof timing.delay === "number" ? timing.delay : 0;
    const duration = typeof timing.duration === "number" ? timing.duration : 0;
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(1, (anim.currentTime - delay) / duration));
  }, []);

  const applyScrollProgress = useCallback(
    (el, progress, { useFast = fastRef.current, playState = "running" } = {}) => {
      const durationSec = getScrollDurationSec(el, useFast);
      const elapsedSec = Math.max(0, progress * durationSec);
      const delaySec = INTRO_DELAY_S - elapsedSec;

      el.getAnimations().forEach((a) => {
        if (a.animationName === "creditsRise") a.cancel();
      });

      el.style.animation = "none";
      el.style.transform = "";
      void el.offsetHeight;

      el.style.animation = `creditsRise ${durationSec}s linear ${delaySec}s forwards`;
      el.style.animationPlayState = playState;
    },
    [getScrollDurationSec],
  );

  const jumpToPreEnd = useCallback(() => {
    if (endSequenceStartedRef.current) return;
    const el = scrollRef.current;
    if (!el) return;

    measurePreEndProgress();
    applyScrollProgress(el, preEndProgressRef.current);
    setPaused(false);
    setEndPhase("scrolling");
    setHintVisible(false);
  }, [measurePreEndProgress, applyScrollProgress]);

  const startThankYou = useCallback(() => {
    setEndPhase("thankYou");
    clearTimeout(thankYouTimerRef.current);
    thankYouTimerRef.current = window.setTimeout(() => {
      setEndPhase("done");
      setPlayerOpen(true);
      setHintVisible(false);
      ensureLoadingMusic();
    }, THANK_YOU_MS);
  }, [ensureLoadingMusic]);

  const beginTheEndHold = useCallback(() => {
    if (endSequenceStartedRef.current) return;
    endSequenceStartedRef.current = true;
    setPaused(true);
    setEndPhase("theEndHold");
    setHintVisible(false);
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(startThankYou, THE_END_HOLD_MS);
  }, [startThankYou]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !ready) return;

    const onAnimationEnd = (event) => {
      if (event.animationName !== "creditsRise") return;
      beginTheEndHold();
    };

    el.addEventListener("animationend", onAnimationEnd);
    return () => el.removeEventListener("animationend", onAnimationEnd);
  }, [ready, beginTheEndHold]);

  useEffect(() => {
    if (!ready || endPhase !== "scrolling" || paused) return;

    const title = theEndTitleRef.current;
    const viewport = scrollRef.current?.parentElement;
    if (!title || !viewport) return;

    let rafId = 0;

    const stopTick = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const tick = () => {
      if (endSequenceStartedRef.current || endPhase !== "scrolling") {
        stopTick();
        return;
      }

      const titleRect = title.getBoundingClientRect();
      const viewRect = viewport.getBoundingClientRect();
      const titleCy = titleRect.top + titleRect.height / 2;
      const viewCy = viewRect.top + viewRect.height / 2;
      const targetCy = viewCy - THE_END_CENTER_BIAS_PX;
      const settleSlack = Math.min(20, viewRect.height * 0.025);
      if (titleCy <= targetCy + settleSlack) {
        stopTick();
        beginTheEndHold();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    const proximityIo = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!rafId) rafId = requestAnimationFrame(tick);
        } else {
          stopTick();
        }
      },
      { root: viewport, rootMargin: "320px 0px", threshold: 0 },
    );

    proximityIo.observe(title);

    return () => {
      proximityIo.disconnect();
      stopTick();
    };
  }, [ready, endPhase, paused, beginTheEndHold]);

  useEffect(
    () => () => {
      clearTimeout(holdTimerRef.current);
      clearTimeout(thankYouTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !ready) return;
    el.style.animationPlayState = paused ? "paused" : "running";
  }, [paused, ready]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !ready || endSequenceStartedRef.current) return;

    const hasInlineScroll =
      el.style.animation && el.style.animation !== "none" && el.style.animation.includes("creditsRise");

    if (!hasInlineScroll) return;

    const progress = readScrollProgress(el);
    applyScrollProgress(el, progress, {
      playState: paused ? "paused" : "running",
    });
  }, [fast, ready, paused, readScrollProgress, applyScrollProgress]);

  const togglePause = useCallback(() => {
    if (endPhase === "theEndHold" || endPhase === "thankYou") return;
    ensureLoadingMusic();
    setPaused((p) => !p);
    setHintVisible(false);
  }, [ensureLoadingMusic, endPhase]);

  const toggleFast = useCallback((e) => {
    e?.stopPropagation?.();
    setFast((f) => !f);
    setHintVisible(false);
  }, []);

  const canControlScroll = useCallback(
    () => !playerOpen && endPhase !== "theEndHold" && endPhase !== "thankYou",
    [playerOpen, endPhase],
  );

  const openPlayer = useCallback(() => {
    if (endPhase === "scrolling") return;
    setPlayerOpen(true);
    setHintVisible(false);
    ensureLoadingMusic();
  }, [ensureLoadingMusic, endPhase]);

  const closePlayer = useCallback(() => {
    setPlayerOpen(false);
  }, []);

  const togglePlayer = useCallback(() => {
    if (playerOpen) closePlayer();
    else openPlayer();
  }, [playerOpen, openPlayer, closePlayer]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" && canControlScroll()) {
        e.preventDefault();
        togglePause();
      }
      if ((e.code === "KeyS" || e.code === "KeyF") && canControlScroll()) {
        e.preventDefault();
        toggleFast();
      }
      if (e.code === "KeyM") {
        e.preventDefault();
        if (endPhase !== "scrolling") togglePlayer();
      }
      if (e.code === "Escape" && playerOpen) {
        e.preventDefault();
        closePlayer();
      }
      if (e.code === "Period" && !playerOpen && endPhase !== "thankYou") {
        e.preventDefault();
        jumpToPreEnd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, toggleFast, togglePlayer, closePlayer, playerOpen, endPhase, jumpToPreEnd, canControlScroll]);

  const creditsEnded = endPhase === "done";

  return (
    <div
      className={`creditsRoot${playerOpen ? " creditsRoot--playerOpen" : ""}${endPhase === "theEndHold" ? " creditsRoot--theEndHold" : ""}`}
      onClick={() => {
        if (!playerOpen) togglePause();
      }}
    >
      <CreditsDecor scanlineActive={!paused && endPhase === "scrolling"} />
      <div className="creditsIntroCurtain" aria-hidden />
      <div className="creditsVignette" aria-hidden />

      <Link href="/" className="creditsBack" onClick={(e) => e.stopPropagation()}>
        ← Back to site
      </Link>

      {creditsEnded && !playerOpen ? (
        <div
          className="creditsMusicBar"
          role="button"
          tabIndex={0}
          aria-label="Open soundtrack player"
          onClick={(e) => {
            e.stopPropagation();
            openPlayer();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              openPlayer();
            }
          }}
        >
          <LoadingAudioViz
            showToggle={false}
            getAnalyser={() => soundsRef.current?.getLoadingAnalyser()}
            getBeatAnalyser={() => soundsRef.current?.getLoadingBeatAnalyser()}
            isMusicPreloaded={() => soundsRef.current?.isMusicPreloaded()}
            isLoadingMusicPlaying={() => soundsRef.current?.isLoadingMusicPlaying()}
          />
        </div>
      ) : null}

      {playerOpen ? (
        <CreditsTrackPlayer
          soundsRef={soundsRef}
          activeTrackId={activeTrackId}
          onTrackSelect={handleTrackSelect}
          onClose={closePlayer}
        />
      ) : null}

      {endPhase === "thankYou" ? <CreditsThankYou /> : null}

      <div className={`creditsHint${hintVisible && !playerOpen && endPhase === "scrolling" ? "" : " hidden"}`}>
        Click or Space to pause · S fast-forward · . skip to finale
      </div>

      <div className="creditsViewport">
        <div className="creditsEmergenceGlow" aria-hidden />
        <div className="creditsFadeTop" aria-hidden />
        <div className="creditsFadeBottom" aria-hidden />

        <div
          ref={scrollRef}
          className={`creditsScroll${paused ? " paused" : ""}${fast ? " fast" : ""}${ready ? " creditsScrollReady" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="creditsSpacerLg" />

          <div className="creditsHero">
            <p className="creditsStudio">Carl Fearby Productions Presents</p>
            <img src="/ui/logo.png" alt="VX-27" className="creditsLogo" />
            <p className="creditsSubtitle creditsSubtitle--shimmer">A First-Person Masterpiece</p>
            <div className="creditsDivider" aria-hidden>
              <span className="creditsDividerLine" />
              <span className="creditsDividerDiamond" />
              <span className="creditsDividerLine" />
            </div>
          </div>

          <div className="creditsSpacerLg" />

          <div className="creditsOpener">
            <CreditBlock role="Written & Directed by" name={CARL} highlight />
            <CreditBlock role="Based on an original idea by" name="Fray Carl" />
            <CreditBlock role="Inspired by the dreams of" name="Earl Farby" />
          </div>

          <CreditsInterstitial kind="art-vx27" />

          <div className="creditsSpacerLg" />

          <ProductionStaffSection />

          <div className="creditsSpacer" />

          {SECTIONS.map((section, sectionIndex) => (
            <Fragment key={section.title}>
              <CreditsInterstitial kind={INTERSTITIAL_CYCLE[sectionIndex % INTERSTITIAL_CYCLE.length]} />
              <CreditSection {...section} />
              {section.title === "Audio" ? <SongsSection /> : null}
              {PROPS_AFTER[section.title] ? (
                <CreditsPropInsert {...PROPS_AFTER[section.title]} />
              ) : null}
            </Fragment>
          ))}

          <CreditsPropInsert layout="finale-row" />

          <p className="creditsQuote">
            &ldquo;We couldn&apos;t have done it without the team.&rdquo;
            <br />
            — Carl Fearby, after crediting himself {PRODUCTION_STAFF.length} times under different names
          </p>

          <div className="creditsFinale">
            <p className="creditsFinaleLead">
              In association with {GOLD_STAFF.join(" · ")}
            </p>
            <p className="creditsFinaleLead creditsFinaleLead--tight">
              Written · Directed · Produced · Programmed · Designed · Composed ·
              <br />
              Tested · Deployed · Credited · And Blamed For Everything By
            </p>
            <p className="creditsFinaleName">{CARL}</p>
          </div>

          <AnagramReveal />

          <p className="creditsLegal">
            VX-27 © {new Date().getFullYear()} Carl Fearby. All rights reserved.
            All wrongs reserved. All middling-rights reserved by Carl Fearby acting in
            his capacity as Carl Fearby. Unauthorized duplication, distribution, or
            existence of this game may result in Carl Fearby noticing.
          </p>

          <div className="creditsSpacerLg" />

          <div ref={preEndMarkerRef} className="creditsPreEndMarker" aria-hidden />

          <CreditsBigBangFinale titleRef={theEndTitleRef} />

          <div className="creditsSpacerLg" />
          <div className="creditsSpacerLg" />
        </div>
      </div>
    </div>
  );
}
