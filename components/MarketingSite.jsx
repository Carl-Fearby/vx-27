"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import CreditsScanlineCanvas from "@/components/CreditsScanlineCanvas";
import MarketingBrowserBanner, {
  useNonChromeBrowser,
} from "@/components/MarketingBrowserBanner";

const POSTER = "/ui/vx-27poster.webp";
const GITHUB_REPO = "https://github.com/neofuture/GameEngine2";

const CONTACT = {
  name: "Carl Fearby",
  email: "carlfearby@me.com",
  whatsappDisplay: "07940 147138",
  whatsappHref: "https://wa.me/447940147138",
};

const TELEMETRY = [
  { label: "STATUS", value: "Solo build · needs collaborators" },
  { label: "ZONE", value: "Exclusion sector · sealed" },
  { label: "THREAT", value: "Remnant · contractors · drones" },
  { label: "RENDER", value: "WebGL · Three.js" },
  { label: "DEPLOY", value: "Zero install" },
];

const COLLAB_AREAS = [
  {
    label: "Code",
    text: "JavaScript, React, Three.js, and browser-native game systems — movement, weapons, lighting, collision, and performance.",
  },
  {
    label: "Level design",
    text: "Industrial sectors, props, vertical layout, and encounter flow. Help shape arenas that feel abandoned in a hurry.",
  },
  {
    label: "Art & atmosphere",
    text: "Textures, materials, environmental storytelling, and the dirty industrial look — rust, concrete, oil, and smoke.",
  },
  {
    label: "Audio",
    text: "Spatial SFX, ambient beds, weapon feedback, and score. Atmosphere is half the dread.",
  },
  {
    label: "Narrative",
    text: "Lore, mission copy, HUD voice, and faction writing. The experiment still needs a story.",
  },
  {
    label: "QA & playtesting",
    text: "Break builds, report bugs, stress-test performance, and tell us what feels wrong before players do.",
  },
];

const BRIEFING = [
  {
    label: "Situation",
    text: "VX-27 was an experimental combat initiative — autonomous battlefield systems, enhanced soldiers, chemical performance boosters. Officially a security project. Unofficially, a human trial zone hidden inside abandoned industrial districts and forgotten urban ruins.",
  },
  {
    label: "Objective",
    text: "You are part of a specialist breach team sent into the exclusion zone to recover classified assets before rival forces do. The mission begins as a recovery operation. It becomes a survival operation.",
  },
  {
    label: "Threat",
    text: "The contaminated sectors are still active. Automated defence systems patrol. Rogue mercenary units fight over whatever technology remains. The deeper you push, the clearer it becomes: VX-27 was never just a weapon. It was a control system.",
  },
];

const STORY_BEATS = [
  {
    chapter: "Origin",
    title: "The programme",
    body: "In the near future, the world's most powerful defence corporations stopped building weapons for governments — and started building wars for themselves. At the centre of it all was VX-27.",
    detail: "Autonomous battlefield systems. Enhanced soldiers. Chemical performance boosters.",
  },
  {
    chapter: "Collapse",
    title: "Locked down overnight",
    body: "When the programme collapsed, the test zones were sealed. No evacuation. No rescue. No witnesses. Years later, the walls are failing.",
    detail: "Survivors whisper about strange signals from deep inside the old testing grounds.",
  },
  {
    chapter: "The zone",
    title: "A graveyard of failed experiments",
    body: "Flooded corridors glow with emergency lights. Security drones still scan empty rooms. Ammo crates sit beside bodies nobody came back for. Barrels leak chemical residue into cracked concrete floors.",
    detail: "The world did not end here. It was engineered here.",
  },
  {
    chapter: "Now",
    title: "Something is still running",
    body: "You push deeper into rusted steel, broken concrete, toxic spills, and military technology that refuses to die. Old HUD transmitters flicker with mission data from soldiers long dead.",
    detail: "VX-27 was not shut down. It adapted.",
  },
];

const FACTIONS = [
  {
    id: "FAC-01",
    name: "The Remnant",
    line: "Former security forces trapped inside the zone. Some are loyal to the old programme. Some have gone rogue. All of them know the terrain better than you do.",
  },
  {
    id: "FAC-02",
    name: "Blacksite Contractors",
    line: "Private military teams sent in by corporations to recover VX-27 assets. They are not interested in rescue. They are not interested in witnesses.",
  },
  {
    id: "FAC-03",
    name: "Automated Defence Systems",
    line: "Drones, turrets, scanners, and dormant combat machines still following corrupted orders from the original VX-27 command network.",
  },
  {
    id: "FAC-04",
    name: "The Exposed",
    line: "Survivors altered by long-term exposure to experimental compounds and battlefield conditioning systems. Unpredictable, aggressive, and drawn to signal activity.",
  },
];

const OPS = [
  {
    code: "CRG",
    title: "VX-27 cargo module",
    body: "Corrugated shell, rounded roof matching the floor, interior liner, and twin doors on E. Thirty-seven PBR maps shipped as WebP — ~96% lighter. Bullet holes stick to doors open or closed.",
    accent: "WebP · E interact",
  },
  {
    code: "MOV",
    title: "Tactical movement",
    body: "Sprint until your lungs disagree, crouch under fire, read stair ramps before you commit. Vertical space is cover — not decoration.",
    accent: "0.12s response",
  },
  {
    code: "WPN",
    title: "Iron-sight gunplay",
    body: "Recoil you can feel, ADS that costs time, a cone torch for night work and attached rooms. Every weapon feels like it was built for a war that got out of control.",
    accent: "hitscan + torch",
  },
  {
    code: "HZD",
    title: "Burning barrels",
    body: "Stacked oil drums, interior fire video, dual flicker lights per barrel with independent shadow play. Chemical residue on cracked concrete. Hazards compound.",
    accent: "paired dynamic light",
  },
  {
    code: "NAV",
    title: "Industrial sectors",
    body: "Attached rooms, ceiling cuts, perimeter catwalks, flooded corridors. Every environment tells the story of something abandoned in a hurry.",
    accent: "multi-level",
  },
];

export default function MarketingSite() {
  const [navSolid, setNavSolid] = useState(false);
  const showBrowserBanner = useNonChromeBrowser();

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`mkt${showBrowserBanner ? " mktHasBrowserBanner" : ""}`}>
      {showBrowserBanner ? <MarketingBrowserBanner /> : null}
      <CreditsScanlineCanvas active />
      <div className="mktGrid" aria-hidden />
      <div className="mktNoise" aria-hidden />
      <div className="mktVignette" aria-hidden />
      <div className="mktBrackets" aria-hidden />

      <header className={`mktNav${navSolid ? " mktNavSolid" : ""}`}>
        <Link href="/" className="mktNavBrand">
          <Image
            src="/ui/logo.png"
            alt="VX-27 home"
            width={140}
            height={48}
            className="mktNavLogo"
            priority
          />
        </Link>
        <nav className="mktNavLinks" aria-label="Primary">
          <a href="#briefing">Briefing</a>
          <a href="#story">Story</a>
          <a href="#factions">Threats</a>
          <a href="#ops">Systems</a>
          <a href="#collaborate">Join us</a>
          <a href="#contact">Contact</a>
          <Link href="/credits">Credits</Link>
          <Link href="/game" className="mktNavPlay">
            <span>Deploy</span>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M2 2l10 5-10 5V2z" fill="currentColor" />
            </svg>
          </Link>
        </nav>
      </header>

      <main id="main-content">
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
              <span className="mktStatusText">Exclusion zone link established</span>
              <span className="mktStatusSep">·</span>
              <span className="mktStatusDim">SYS/VX-27</span>
              <span className="mktWipBadge">Work in progress</span>
            </div>

            <h1 className="mktHeroTitle">
              <span className="mktSrOnly">VX-27 — </span>
              <span className="mktHeroTitleLine">Enter the</span>
              <span className="mktHeroTitleLine mktHeroTitleAccent">exclusion zone.</span>
            </h1>

            <p className="mktHeroDeck">
              A classified weapons programme has gone dark. The city is sealed.
              The systems are active. The enemy is already inside. VX-27 drops you
              into a brutal near-future combat zone built from rusted steel, broken
              concrete, toxic spills, abandoned weapons, and military technology
              that refuses to die.
            </p>
            <p className="mktHeroTagline">
              VX-27 — The experiment is still running. I built what you can play
              today mostly on my own — I cannot finish this without collaborators
              who want to make games for fun.
            </p>

            <div className="mktHeroActions">
              <Link href="/game" className="mktPlayBtn">
                <span className="mktPlayBtnLabel">Enter the zone</span>
                <span className="mktPlayBtnSub">Click to capture mouse</span>
              </Link>
              <a href="#collaborate" className="mktGhostLink">
                Help build it
                <span aria-hidden>↓</span>
              </a>
              <a href="#briefing" className="mktGhostLink">
                Read the briefing
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
          <h2>A classified weapons programme. A dead city. A war nobody was meant to survive.</h2>
          <p className="mktBriefingLead">
            VX-27 is a tactical sci-fi FPS set inside a collapsed military test zone
            where abandoned weapons, rogue soldiers, and automated defence systems still
            fight a war that should have ended years ago. Enter contaminated industrial
            sectors, recover classified technology, survive hostile forces, and uncover
            the truth behind the VX-27 programme — before the system decides you are
            part of the experiment.
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
            &ldquo;And something inside the zone is still running the experiment.&rdquo;
          </p>
          <footer>— Breach team intercept, signal marked VX-27</footer>
        </blockquote>
      </section>

      <section id="story" className="mktStory">
        <div className="mktStoryHead">
          <p className="mktKicker">World lore</p>
          <h2>The zone was engineered for war. Now it keeps the war alive.</h2>
          <p className="mktStoryDeck">
            The VX-27 zone was once a sprawling industrial weapons district — part
            factory, part research site, part urban combat simulation. Every street,
            warehouse, bunker, and service tunnel was designed to test new forms of
            warfare. Now the place is a graveyard of failed experiments.
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

      <section id="factions" className="mktComms">
        <div className="mktCommsHead">
          <p className="mktKicker">Enemy factions</p>
          <h2>Hostile forces inside the exclusion zone</h2>
        </div>
        <div className="mktCommsFeed">
          {FACTIONS.map((faction) => (
            <article key={faction.id} className="mktCommsLine">
              <header>
                <span className="mktCommsId">{faction.id}</span>
                <span className="mktCommsSpeaker">{faction.name}</span>
              </header>
              <p>{faction.line}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="ops" className="mktOps">
        <div className="mktOpsHead">
          <p className="mktKicker">Combat systems</p>
          <h2>Grounded sci-fi combat. Dirty industrial realism.</h2>
          <p className="mktOpsDeck">
            This is not a shiny future. This is rust, concrete, oil, smoke, metal,
            and panic. VX-27 is built around oppressive atmosphere, tactical HUD
            design, and combat that punishes curiosity. These are the tools you
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
          <p className="mktKicker">Player role</p>
          <h2>You are not a superhero. You are not the chosen one.</h2>
          <p className="mktIntelBody">
            You are a trained operator dropped into a hostile zone with limited intel,
            limited ammunition, and a command structure that may not be telling you
            the full truth. Then it becomes something worse — a choice between extracting
            the VX-27 technology or destroying everything before it reaches the outside
            world.
          </p>
          <p className="mktIntelBody">
            The trial runs entirely in your browser — load the page, lock the mouse,
            and accept that the loading screen music will outlast your first life.
            Real-time shadows, layered interior lighting, and piles that look dumped
            by someone in a hurry. v0.1.5 trimmed container texture load by ~96% and
            tightened the frame budget around room lights and fire video.
          </p>
          <ul className="mktIntelList">
            <li>Pointer-lock FPS — WASD, sprint, crouch, aim, torch on F</li>
            <li>VX-27 cargo container — open doors, fight inside, bullet decals on shell</li>
            <li>Container PBR maps as WebP (~40 MB saved); roof and floor caps share materials</li>
            <li>Catwalks, stairs, attached dark rooms with real collision</li>
            <li>Dumped barrel pile and burning open-top drum beside the module</li>
            <li>Grenades, health, stamina pickups — full HUD with compass and radar</li>
          </ul>
          <p className="mktIntelBody" style={{ marginTop: "1rem" }}>
            Settings → Development opens live tuning panels on localhost — weapon pose,
            lighting, barrel pile placement, VX-27 container JSON export, door depth, and
            more. HUD position tuning is opt-in. Tweak in-game, copy JSON, bake into the level.
          </p>
          <Link href="/game" className="mktPlayBtn mktPlayBtnCompact">
            <span className="mktPlayBtnLabel">Play now</span>
            <span className="mktPlayBtnSub">Free · in-browser</span>
          </Link>
        </div>
      </section>

      <section id="collaborate" className="mktCollaborate">
        <div className="mktCollaborateHead">
          <p className="mktKicker">Development status</p>
          <h2>I cannot build this alone.</h2>
          <p className="mktCollaborateLead">
            Everything you can play right now — the movement, the guns, the barrels,
            the lighting, the levels — has been built mostly by one person in spare
            time. That was enough to prove the idea. It is not enough to finish VX-27.
          </p>
          <p className="mktCollaborateLead">
            I need collaborators. Not employees. Not investors. People who want to
            make a game for fun — to learn, experiment, break things, and see something
            cool come together without treating it like a job interview.
          </p>
          <p className="mktCollaborateLead">
            No studio résumé required. If you are curious about game development and
            happy to pitch in when you can, you are exactly who I am looking for.
          </p>
        </div>

        <blockquote className="mktPullQuote mktCollaborateQuote">
          <p>
            &ldquo;I can keep pushing this forward on my own — but I cannot get it
            to where it deserves to be without help. If building games for fun sounds
            like your kind of stupid idea, get in touch.&rdquo;
          </p>
          <footer>— {CONTACT.name}</footer>
        </blockquote>

        <div id="contact" className="mktContact">
          <p className="mktKicker">Get in touch</p>
          <h2>Talk to me directly</h2>
          <p className="mktContactLead">
            I&apos;m {CONTACT.name} — building VX-27 mostly on my own in spare time.
            If you want to collaborate, ask a question, or just say hello, WhatsApp or
            email is fine. No recruiters, no pitch deck — {CONTACT.name}, straight about what
            this is and where it needs help.
          </p>
          <div className="mktContactLinks">
            <a
              href={CONTACT.whatsappHref}
              className="mktContactLink"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="mktContactLinkLabel">WhatsApp</span>
              <span className="mktContactLinkValue">{CONTACT.whatsappDisplay}</span>
            </a>
            <a href={`mailto:${CONTACT.email}`} className="mktContactLink">
              <span className="mktContactLinkLabel">Email</span>
              <span className="mktContactLinkValue">{CONTACT.email}</span>
            </a>
          </div>
        </div>

        <div className="mktCollaborateGrid">
          {COLLAB_AREAS.map((area) => (
            <article key={area.label} className="mktCollaborateCard">
              <h3>{area.label}</h3>
              <p>{area.text}</p>
            </article>
          ))}
        </div>

        <div className="mktCollaborateCta">
          <p className="mktCollaborateCtaLead">
            Prefer GitHub? Introduce yourself there — tell me what you would like to work
            on, what you want to learn, and how much time you realistically have. Or
            message me on{" "}
            <a href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>{" "}
            /{" "}
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. No pressure, no
            nonsense.
          </p>
          <div className="mktCollaborateActions">
            <a
              href={GITHUB_REPO}
              className="mktPlayBtn mktPlayBtnCompact"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="mktPlayBtnLabel">View on GitHub</span>
              <span className="mktPlayBtnSub">Say hello · no résumé needed</span>
            </a>
            <a href={`${GITHUB_REPO}/issues`} className="mktGhostLink" target="_blank" rel="noopener noreferrer">
              Open an issue to collaborate
              <span aria-hidden>↗</span>
            </a>
          </div>
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
        <h2>Survive the breach. Recover the truth.</h2>
        <p>
          Escape before the zone closes around you. Fullscreen recommended.
          Headphones help. Dark rooms want the torch — burning barrels want distance.
        </p>
        <p className="mktLaunchNarrative">
          You were sent to recover a weapon. You found something worse.
        </p>
        <Link href="/game" className="mktPlayBtn mktPlayBtnLaunch">
          <span className="mktPlayBtnLabel">Launch VX-27</span>
        </Link>
      </section>
      </main>

      <footer className="mktFooter">
        <p>© VX-27 · {CONTACT.name}</p>
        <div className="mktFooterLinks">
          <Link href="/game">Play</Link>
          <a href="#collaborate">Collaborate</a>
          <a href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a href={`mailto:${CONTACT.email}`}>Email</a>
          <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
          <Link href="/credits">Credits</Link>
          <Link href="/version">Version</Link>
        </div>
      </footer>
    </div>
  );
}
