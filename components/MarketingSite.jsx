"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import packageJson from "../package.json";
import CreditsScanlineCanvas from "@/components/CreditsScanlineCanvas";
import MarketingControlPanelPreview from "@/components/MarketingControlPanelPreview";
import MarketingBrowserBanner, {
  useNonChromeBrowser,
} from "@/components/MarketingBrowserBanner";

const BUILD_VERSION = packageJson.version;

const POSTER = "/ui/vx-27poster.webp";
const GITHUB_REPO = "https://github.com/Carl-Fearby/vx-27";

const CONTACT = {
  name: "Carl Fearby",
  email: "carlfearby@me.com",
  whatsappDisplay: "07940 147138",
  whatsappHref: "https://wa.me/447940147138",
};

const TELEMETRY = [
  { label: "STATUS", value: "Solo build · needs collaborators" },
  { label: "BUILD", value: `v${BUILD_VERSION} · container beacons · kill pre-bake` },
  { label: "PLATFORM", value: "Desktop · iPad Safari · zero install" },
  { label: "ZONE", value: "Exclusion sector · sealed" },
  { label: "RENDER", value: "WebGL · Three.js · GPU preload on load" },
  { label: "DEPLOY", value: "Browser native · no app store" },
];

const NODE_BREACH_SPECS = [
  ["Console access", "H at prompt · H again to end early"],
  ["Breach grid", "WASD select nodes · SPACE confirm routes"],
  ["Timer", "60s pressure · security trip retries same seed"],
  ["Security shuffle", "Death moves one tripped node · clock resets"],
  ["Screen C", "Green on success · red on fail or early exit"],
  ["Shelf D", "PBR shelf quad · clamped hero UV"],
  ["Hull prop", "Sharp extrusion · plinth clearance · tiled PBR"],
  ["Hack audio", "Neon Gate Rush · combat mix muted underneath"],
  ["Rewards", "Score cache pickup · four-second HUD flash"],
];

const WHATS_NEW = [
  {
    tag: "v0.1.39",
    title: "Emergency container beacons",
    text: "Blue and orange rotating beacons inside VX-27 crates — fast exterior sweeps, wide interior flood strobes, and light that spills through open doors only.",
  },
  {
    tag: "v0.1.39",
    title: "Sealed container doors",
    text: "Closed door leaves and end caps block light leaks. Interior shell fixes keep the crate dark until you open a hatch.",
  },
  {
    tag: "v0.1.39",
    title: "Kill pre-bake",
    text: "Game logic pre-warms headshot ragdolls when you share a container with a target or have line of sight — load-screen GPU bake for every target too.",
  },
  {
    tag: "v0.1.39",
    title: "Container performance",
    text: "Frustum culling hides off-screen crate interiors; beacon and door updates skip when culled. Startup GPU preload simulates ~2s of beacon motion.",
  },
  {
    tag: "v0.1.38",
    title: "NODE BREACH console hack",
    text: "Face a control panel, press H, and route power through the breach grid. WASD selects nodes, SPACE locks routes, security columns punish mistakes. Screen C flashes green on success or red when you bail or fail.",
  },
  {
    tag: "v0.1.38",
    title: "Procedural control panel",
    text: "Arena console prop with hull overlays, screen C monitor slope, and shelf D quads — sharp extrusion profile, PBR maps as WebP, emissive screen flash after every hack outcome.",
  },
  {
    tag: "v0.1.38",
    title: "Neon Gate Rush",
    text: "NODE BREACH theme layers over muted combat mix while you hack; level music returns full when you exit. Preview every track at /music without touching your loading-screen choice.",
  },
  {
    tag: "v0.1.38",
    title: "Score tokens & reward flashes",
    text: "3D score disk collectibles with shared pickup bob. Hack pass rewards and floor pickups share the same four-second HUD flash — credits, ammo, medkit.",
  },
  {
    tag: "v0.1.37",
    title: "Hack UI & weather",
    text: "NODE BREACH overlay with animated nodes, secure-channel pulse bars, and a layout tuning wizard. Outdoor rain and snow with intensity sliders — mutually exclusive, off inside containers.",
  },
  {
    tag: "v0.1.37",
    title: "Console screen flash",
    text: "Screen C turns green on hack success and red on failure or early exit. Dev brightness tuning for sheltered and room consoles.",
  },
  {
    tag: "v0.1.24",
    title: "iPad touch controls",
    text: "Move stick, look drag zone, and FIRE / AIM / JUMP buttons on coarse-pointer devices. HUD scales for tablet safe areas — play in Safari without a keyboard.",
  },
  {
    tag: "Audio",
    title: "Galactic Drifter soundtrack",
    text: "Loading theme and in-game combat mix — now with a dedicated /music page and the same visualizer player from the credits roll.",
  },
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
    code: "PAD",
    title: "iPad & touch breach",
    body: "On-screen move stick, right-side look drag, and action buttons for fire, aim, jump, reload, and door USE. HUD lifts clear of your thumbs — no pointer lock on tablet.",
    accent: "v0.1.24 · Safari",
  },
  {
    code: "GPU",
    title: "Load-screen GPU bake",
    body: "Real gameplay render path on the loading bar — compileAsync, texture upload, doorway poses, stair climb, flashlight and muzzle priming. Pay the cost before the breach.",
    accent: "v0.1.14+ preload",
  },
  {
    code: "HCK",
    title: "NODE BREACH console hack",
    body: "H at a facing console opens the breach grid — WASD to select nodes, SPACE to confirm routes, security columns to dodge, 60s timer throughout. Neon Gate Rush plays while combat mix stays muted; success flashes screen C green; bail with H and it stays red for what's left on the clock.",
    accent: "H breach · H end",
  },
  {
    code: "PNL",
    title: "Control panel console",
    body: "Procedural console prop in the arena — tiled hull PBR, screen C monitor slope, shelf D top quad, sharp extrusion profile, plinth floor clearance. Screen C emissive flash maps for green success and red failure.",
    accent: "screen C · shelf D",
  },
  {
    code: "WX",
    title: "Rain & snow",
    body: "Outdoor streak rain with catwalk occluders, or round falling snow that settles on decks and stairs. Settings intensity 5%–500%; neither runs inside VX-27 containers.",
    accent: "mutually exclusive",
  },
  {
    code: "CRG",
    title: "VX-27 cargo module",
    body: "Corrugated shell, rounded roof matching the floor, interior liner, and twin doors on E. Thirty-seven PBR maps shipped as WebP — ~96% lighter. Bullet holes stick to doors open or closed.",
    accent: "WebP · E interact",
  },
  {
    code: "WPN",
    title: "Iron-sight gunplay",
    body: "Recoil you can feel, ADS that costs time, muzzle-aligned laser tracers in weapon blue, torch on F for night work. N toggles sun and moon with a ten-second crossfade.",
    accent: "hitscan + Line2 tracers",
  },
  {
    code: "MOV",
    title: "Tactical movement",
    body: "Sprint until your lungs disagree, crouch under fire, read stair ramps before you commit. Vertical space is cover — not decoration.",
    accent: "0.12s response",
  },
  {
    code: "HZD",
    title: "Burning barrels",
    body: "Stacked oil drums, interior fire video, dual flicker lights per barrel with independent shadow play. SE corner pile mirrors the module hazard layout.",
    accent: "paired dynamic light",
  },
  {
    code: "NAV",
    title: "Industrial sectors",
    body: "Attached service rooms, pillar-shell walls, ceiling cuts, perimeter catwalks. Doorway lighting and room culling that finally behave at the threshold.",
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
      <div className="mktSparkleField" aria-hidden>
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className="mktSparkle" style={{ "--sparkle-i": i }} />
        ))}
      </div>
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
          <a href="#breach">NODE BREACH</a>
          <a href="#ops">Systems</a>
          <a href="#collaborate">Join us</a>
          <a href="#contact">Contact</a>
          <Link href="/music">Music</Link>
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
              <Link href="/version" className="mktBuildBadge">
                Latest · v{BUILD_VERSION}
              </Link>
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
                <span className="mktPlayBtnSub">Desktop · mouse lock · iPad touch</span>
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

      <section className="mktWhatsNew" aria-labelledby="whats-new-heading">
        <div className="mktWhatsNewHead">
          <p className="mktKicker">Transmission · build {BUILD_VERSION}</p>
          <h2 id="whats-new-heading">What landed this week</h2>
          <p className="mktWhatsNewDeck">
            Procedural control panel consoles, NODE BREACH grid hacking with screen C flashes,
            Neon Gate Rush hack audio, score disk collectibles, outdoor rain and snow, and a
            dedicated /music soundtrack page — plus iPad touch and GPU preload.
            Play v{BUILD_VERSION} in your browser; no install.
          </p>
        </div>
        <div className="mktWhatsNewGrid">
          {WHATS_NEW.map((item) => (
            <article key={item.title} className="mktWhatsNewCard">
              <span className="mktWhatsNewTag">{item.tag}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <div className="mktWhatsNewCta">
          <Link href="/version" className="mktGhostLink">
            Full version history
            <span aria-hidden>↗</span>
          </Link>
          <Link href="/game" className="mktPlayBtn mktPlayBtnCompact">
            <span className="mktPlayBtnLabel">Play v{BUILD_VERSION}</span>
            <span className="mktPlayBtnSub">Desktop or iPad · free</span>
          </Link>
        </div>
      </section>

      <section id="breach" className="mktBreach">
        <div className="mktBreachVisual">
          <MarketingControlPanelPreview />
          <div className="mktBreachHud" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ui/hack/node-live.png" alt="" width={28} height={28} />
            <img src="/ui/hack/line.png" alt="" width={48} height={12} />
            <img src="/ui/hack/pointer.png" alt="" width={20} height={20} />
            <img src="/ui/hack/reward-cache.png" alt="" width={26} height={26} />
          </div>
        </div>
        <div className="mktBreachCopy">
          <p className="mktKicker">NODE BREACH · SYS/CONSOLE</p>
          <h2>Face the console. Breach the grid. Beat the clock.</h2>
          <p className="mktBreachLead">
            Industrial control panels now sit in the arena — procedural hull, emissive screen C,
            shelf D overlays, and a full-screen NODE BREACH overlay when you press H. Route power,
            dodge security nodes, and read the monitor: green means you got away with it, red means
            you did not.
          </p>
          <dl className="mktBreachSpecs">
            {NODE_BREACH_SPECS.map(([label, value]) => (
              <div key={label} className="mktBreachSpecRow">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Link href="/game" className="mktPlayBtn mktPlayBtnCompact">
            <span className="mktPlayBtnLabel">Breach a console</span>
            <span className="mktPlayBtnSub">H at prompt · desktop or iPad</span>
          </Link>
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
            The trial runs entirely in your browser — desktop with pointer lock, or iPad
            with on-screen sticks and buttons. Load the page, breach the zone, and accept
            that the loading screen music will outlast your first life. Real-time shadows,
            layered interior lighting, procedural props, and piles that look dumped by
            someone in a hurry.
          </p>
          <ul className="mktIntelList">
            <li>Desktop FPS — WASD, sprint, crouch, aim, torch on F, day/night on N</li>
            <li>iPad &amp; touch — move stick, look drag, FIRE / AIM / JUMP / USE buttons</li>
            <li>Muzzle-aligned laser tracers and contextual F-for-flashlight hints at night</li>
            <li>NODE BREACH console hack — grid routing, security nodes, 60s timer, H to breach or end early</li>
            <li>Procedural control panel — hull PBR, screen C emissive flash, shelf D quad overlays</li>
            <li>Neon Gate Rush hack theme · combat mix muted during breach · /music preview page</li>
            <li>Score token disks, hack reward flashes, outdoor rain and snow intensity sliders</li>
            <li>VX-27 cargo container — open doors on E, bullet decals on shell</li>
            <li>Catwalks, stairs, attached service rooms with pillar-shell lighting</li>
            <li>Dumped barrel pile and burning open-top drum — SE corner layout</li>
            <li>Grenades, health, stamina pickups — full HUD with compass and radar</li>
            <li>GPU preload on the loading bar — fewer first-frame hitches after Start Game</li>
          </ul>
          <p className="mktIntelBody" style={{ marginTop: "1rem" }}>
            Settings → Development opens live tuning panels on localhost when enabled —
            weapon pose, lighting, barrel pile placement, VX-27 container JSON export, and
            more. Tweak in-game, copy JSON, bake into the level.
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
        <div className="mktLaunchSparkleRing" aria-hidden />
        <Image
          src="/ui/logo.png"
          alt="VX-27"
          width={480}
          height={160}
          className="mktLaunchLogo"
        />
        <h2>Survive the breach. Recover the truth.</h2>
        <p>
          Escape before the zone closes around you. Fullscreen recommended on desktop;
          landscape on iPad. Headphones help. Dark rooms want the torch — burning barrels
          want distance.
        </p>
        <p className="mktLaunchNarrative">
          You were sent to recover a weapon. You found something worse.
        </p>
        <p className="mktLaunchBuildNote">
          Now live · v{BUILD_VERSION} · container beacons · NODE BREACH · soundtrack at /music
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
          <Link href="/music">Music</Link>
          <Link href="/credits">Credits</Link>
          <Link href="/version">Version</Link>
        </div>
      </footer>
    </div>
  );
}
