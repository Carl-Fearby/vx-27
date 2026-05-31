"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import CreditsScanlineCanvas from "@/components/CreditsScanlineCanvas";

const POSTER = "/ui/vx-27poster.png";

const TELEMETRY = [
  { label: "RENDER", value: "WebGL · Three.js" },
  { label: "ARENA", value: "Modular industrial" },
  { label: "INPUT", value: "KBM · pointer lock" },
  { label: "AUDIO", value: "Spatial SFX + score" },
  { label: "DEPLOY", value: "Zero install" },
];

const BRIEFING = [
  {
    label: "Situation",
    text: "Sector 27 was a fuel-handling yard before the trial program moved in. Now it is a live-fire box: concrete, catwalks, and rooms bolted onto the perimeter like afterthoughts.",
  },
  {
    label: "Objective",
    text: "Move fast, spend stamina wisely, and treat vertical space as cover — not decoration. Targets reset. Barrels do not.",
  },
  {
    label: "Threat",
    text: "Open drums burn from the inside out. Grenades roll. Pickups tempt you into bad angles. The arena remembers every shortcut you take twice.",
  },
];

const STORY_BEATS = [
  {
    chapter: "Act I",
    title: "The floor remembers footfall",
    body: "You drop into gravel and rust-stained asphalt. Corrugated walls swallow sound until gunfire tears the silence open. Doorways cut the arena into lanes; attached service rooms pull you off the main kill floor and into tighter angles.",
    detail: "Learn the sprint rhythm. Crouch under lintels. The compass is honest — the map is not.",
  },
  {
    chapter: "Act II",
    title: "Height is a weapon",
    body: "Stairs climb to a perimeter catwalk that rings the yard. From up here the barrels look like chess pieces someone kicked. North passages bleed into exterior decks — good for flanking, bad for forgetting where the edge is.",
    detail: "Control the catwalk or donate it. Every stair is a funnel. Every landing is a gamble.",
  },
  {
    chapter: "Act III",
    title: "Fire finds the gaps",
    body: "Oil drums stack where physics gave up. One shot turns a pile into a furnace — interior flame, rolling light, heat that punishes curiosity. Grenades finish what the barrels start. The HUD stays minimal until your health disagrees.",
    detail: "Hazards compound. Pickups bait you. Survival is a route, not a stat.",
  },
];

const COMMS = [
  {
    id: "TX-0412",
    speaker: "Control",
    line: "VX-27 trial is hot. You are cleared to the floor. Do not treat the catwalk like a balcony.",
  },
  {
    id: "TX-0419",
    speaker: "Field log",
    line: "Barrel pile at grid zero is unstable. Recommend distance. Recommend not recommending.",
  },
  {
    id: "TX-0427",
    speaker: "Operator",
    line: "Targets down. Stamina spent. Still hearing the fire loop in my head. Request extract. Request more ammo.",
  },
];

const OPS = [
  {
    code: "MOV",
    title: "Arena movement",
    body: "Sprint until your lungs disagree, crouch under fire, read stair ramps before you commit. The floor plan is a weapon — if you learn its grammar.",
    accent: "0.12s response",
  },
  {
    code: "WPN",
    title: "Iron-sight gunplay",
    body: "Recoil you can feel, ADS that costs time, a secondary slot for when the first plan fails. Every shot registers on concrete and corrugated steel.",
    accent: "hitscan + feedback",
  },
  {
    code: "HZD",
    title: "Burning barrels",
    body: "Stacked oil drums, interior fire, proximity heat. The pile does not stay neat. Neither does your route once something ignites.",
    accent: "dynamic light",
  },
  {
    code: "NAV",
    title: "Vertical control",
    body: "Attached rooms, ceiling cuts, perimeter catwalks. Take the high ground or lose it to someone who understood the layout faster.",
    accent: "multi-level",
  },
];

export default function MarketingSite() {
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="mkt">
      <CreditsScanlineCanvas active />
      <div className="mktGrid" aria-hidden />
      <div className="mktNoise" aria-hidden />
      <div className="mktVignette" aria-hidden />
      <div className="mktBrackets" aria-hidden />

      <header className={`mktNav${navSolid ? " mktNavSolid" : ""}`}>
        <Link href="/" className="mktNavBrand">
          <Image src="/ui/logo.png" alt="" width={140} height={48} className="mktNavLogo" priority />
        </Link>
        <nav className="mktNavLinks">
          <a href="#briefing">Briefing</a>
          <a href="#story">Story</a>
          <a href="#ops">Systems</a>
          <Link href="/credits">Credits</Link>
          <Link href="/game" className="mktNavPlay">
            <span>Deploy</span>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M2 2l10 5-10 5V2z" fill="currentColor" />
            </svg>
          </Link>
        </nav>
      </header>

      <section className="mktHero">
        <div className="mktHeroBg" aria-hidden>
          <Image
            src={POSTER}
            alt=""
            fill
            priority
            sizes="100vw"
            className="mktHeroPoster"
            unoptimized
          />
          <div className="mktHeroBgShade" />
        </div>

        <div className="mktHeroInner">
          <div className="mktHeroMain">
            <div className="mktStatusRow">
              <span className="mktPulse" aria-hidden />
              <span className="mktStatusText">Arena link established</span>
              <span className="mktStatusSep">·</span>
              <span className="mktStatusDim">SYS/ARENA-01</span>
            </div>

            <h1 className="mktHeroTitle">
              <span className="mktHeroTitleLine">Close quarters.</span>
              <span className="mktHeroTitleLine mktHeroTitleAccent">Full send.</span>
            </h1>

            <p className="mktHeroDeck">
              The VX-27 trial drops you into a decommissioned fuel yard turned
              combat crucible — a browser-native shooter where industrial decay,
              vertical lanes, and burning barrels write the story faster than you can.
            </p>
            <p className="mktHeroTagline">
              No install. No queue. One arena, many ways to misjudge a corner.
            </p>

            <div className="mktHeroActions">
              <Link href="/game" className="mktPlayBtn">
                <span className="mktPlayBtnLabel">Enter the arena</span>
                <span className="mktPlayBtnSub">Click to capture mouse</span>
              </Link>
              <a href="#briefing" className="mktGhostLink">
                Read the briefing
                <span aria-hidden>↓</span>
              </a>
            </div>
          </div>

          <figure className="mktHeroPreview">
            <Image
              src={POSTER}
              alt="VX-27 promotional poster — Vektor Dynamics"
              width={1055}
              height={1491}
              className="mktPosterImg"
              priority
              unoptimized
            />
          </figure>
        </div>

        <div className="mktHeroTicker">
          {TELEMETRY.map((t) => (
            <div key={t.label} className="mktTickerCell">
              <span className="mktTickerLabel">{t.label}</span>
              <span className="mktTickerValue">{t.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="briefing" className="mktBriefing">
        <div className="mktBriefingIntro">
          <p className="mktKicker">Mission briefing</p>
          <h2>You were sent to evaluate a weapon. The building had other ideas.</h2>
          <p className="mktBriefingLead">
            VX-27 is not a hero story — it is a stress test with architecture.
            A modular industrial arena where movement, aim, and nerve are measured
            in seconds, and the environment keeps score long after the targets fall.
          </p>
        </div>
        <div className="mktBriefingGrid">
          {BRIEFING.map((item) => (
            <article key={item.label} className="mktBriefingCard">
              <h3>{item.label}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <blockquote className="mktPullQuote">
          <p>
            &ldquo;We built a shooter you can launch from a link. Then we built
            an arena mean enough to deserve it.&rdquo;
          </p>
          <footer>— Trial program memo, heavily redacted</footer>
        </blockquote>
      </section>

      <section id="story" className="mktStory">
        <div className="mktStoryHead">
          <p className="mktKicker">Campaign arc</p>
          <h2>Three acts. One yard. No respawn lecture.</h2>
          <p className="mktStoryDeck">
            You will not watch this story — you will walk it. From the first
            footstep on rusted grate to the last glow of barrel fire under the
            catwalk, every layer of the facility teaches a different kind of fear.
          </p>
        </div>
        <div className="mktStoryTimeline">
          {STORY_BEATS.map((beat, i) => (
            <article key={beat.chapter} className="mktStoryBeat">
              <div className="mktStoryMarker">
                <span className="mktStoryIndex">{String(i + 1).padStart(2, "0")}</span>
                <span className="mktStoryChapter">{beat.chapter}</span>
              </div>
              <div className="mktStoryBody">
                <h3>{beat.title}</h3>
                <p>{beat.body}</p>
                <p className="mktStoryDetail">{beat.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mktComms">
        <div className="mktCommsHead">
          <p className="mktKicker">Intercepted traffic</p>
          <h2>Radio chatter from the trial floor</h2>
        </div>
        <div className="mktCommsFeed">
          {COMMS.map((tx) => (
            <article key={tx.id} className="mktCommsLine">
              <header>
                <span className="mktCommsId">{tx.id}</span>
                <span className="mktCommsSpeaker">{tx.speaker}</span>
              </header>
              <p>{tx.line}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="ops" className="mktOps">
        <div className="mktOpsHead">
          <p className="mktKicker">Combat systems</p>
          <h2>The gear speaks last. The arena speaks first.</h2>
          <p className="mktOpsDeck">
            Underneath the fiction is a real shooter: responsive movement, readable
            gunplay, and systems that collide on purpose. These are the tools you
            inherit the moment you cross the threshold.
          </p>
        </div>
        <div className="mktOpsGrid">
          {OPS.map((op) => (
            <article key={op.code} className="mktOpsCard">
              <div className="mktOpsCardTop">
                <span className="mktOpsCode">{op.code}</span>
                <span className="mktOpsAccent">{op.accent}</span>
              </div>
              <h3>{op.title}</h3>
              <p>{op.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="intel" className="mktIntel">
        <figure className="mktIntelVisual">
          <Image
            src={POSTER}
            alt="VX-27 promotional poster"
            width={1055}
            height={1491}
            className="mktPosterImg"
            unoptimized
          />
        </figure>
        <div className="mktIntelCopy">
          <p className="mktKicker">Field intel</p>
          <h2>Built for the browser. Written for the brave or the bored.</h2>
          <p className="mktIntelBody">
            Real-time shadows, layered interior lighting, and barrel piles that
            look dumped by someone in a hurry. The trial runs entirely in your
            browser — load the page, lock the mouse, and accept that the loading
            screen music will outlast your first life.
          </p>
          <p className="mktIntelBody">
            When the arena goes quiet, the credits roll — a monument to everyone
            who touched the project, and approximately one person who touched it
            twice as much as he admits. You can read them. You should read them.
          </p>
          <ul className="mktIntelList">
            <li>Pointer-lock FPS controls — WASD, sprint, crouch, aim</li>
            <li>Catwalks, stairs, and attached rooms with real collision</li>
            <li>Oil barrel fire, grenades, health, and stamina pickups</li>
            <li>Full HUD — compass, radar, ammo, and damage feedback</li>
          </ul>
          <Link href="/game" className="mktPlayBtn mktPlayBtnCompact">
            <span className="mktPlayBtnLabel">Play now</span>
            <span className="mktPlayBtnSub">Free · in-browser</span>
          </Link>
        </div>
      </section>

      <section className="mktLaunch">
        <div className="mktLaunchGlow" aria-hidden />
        <Image
          src="/ui/logo.png"
          alt="VX-27"
          width={480}
          height={160}
          className="mktLaunchLogo"
        />
        <h2>The yard is waiting.</h2>
        <p>
          Fullscreen recommended. Headphones help. The catwalk will not force you
          to crouch anymore — everything else is still trying to kill you.
        </p>
        <p className="mktLaunchNarrative">
          Step through the link. Become the trial. See how far the story goes
          before the barrels rewrite it.
        </p>
        <Link href="/game" className="mktPlayBtn mktPlayBtnLaunch">
          <span className="mktPlayBtnLabel">Launch VX-27</span>
        </Link>
      </section>

      <footer className="mktFooter">
        <p>© VX-27 · GameEngine2</p>
        <div className="mktFooterLinks">
          <Link href="/game">Play</Link>
          <Link href="/credits">Credits</Link>
        </div>
      </footer>
    </div>
  );
}
