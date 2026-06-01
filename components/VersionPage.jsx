import Link from "next/link";
import Image from "next/image";
import packageJson from "../package.json";
import { VERSION_HISTORY } from "@/lib/versionHistory";
import gitCommitHistory from "@/lib/gitCommitHistory.json";

function formatBuildTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function formatReleaseDate(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

function shaMatches(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

const RELEASE_BY_COMMIT = Object.fromEntries(
  VERSION_HISTORY.map((release) => [release.commit, release.version])
);

const BUILD = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version,
  gitSha: process.env.NEXT_PUBLIC_GIT_SHA ?? "dev",
  gitBranch: process.env.NEXT_PUBLIC_GIT_BRANCH ?? "local",
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? "",
};

const STACK = [
  { label: "Next.js", value: packageJson.dependencies?.next ?? "—" },
  { label: "React", value: packageJson.dependencies?.react ?? "—" },
  { label: "Three.js", value: packageJson.dependencies?.three ?? "—" },
];

const ROWS = [
  { label: "Release", value: `v${BUILD.version}` },
  { label: "Commit", value: BUILD.gitSha },
  { label: "Branch", value: BUILD.gitBranch },
  { label: "Built (UTC)", value: formatBuildTime(BUILD.buildTime) },
  ...STACK.map(({ label, value }) => ({
    label,
    value: String(value).replace(/^[\^~]/, ""),
  })),
];

export default function VersionPage() {
  const headRelease = VERSION_HISTORY.find((release) =>
    shaMatches(release.commit, BUILD.gitSha)
  );
  const currentReleaseVersion =
    headRelease?.version ??
    (shaMatches(gitCommitHistory.head, BUILD.gitSha)
      ? VERSION_HISTORY[0]?.version
      : BUILD.version);

  return (
    <div className="mkt mktVersion">
      <div className="mktGrid" aria-hidden />
      <div className="mktNoise" aria-hidden />
      <div className="mktVignette" aria-hidden />
      <div className="mktBrackets" aria-hidden />

      <header className="mktNav mktNavSolid">
        <Link href="/" className="mktNavBrand">
          <Image
            src="/ui/logo.png"
            alt=""
            width={140}
            height={48}
            className="mktNavLogo"
            priority
          />
        </Link>
        <nav className="mktNavLinks">
          <Link href="/">Home</Link>
          <Link href="/game" className="mktNavPlay">
            <span>Deploy</span>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M2 2l10 5-10 5V2z" fill="currentColor" />
            </svg>
          </Link>
        </nav>
      </header>

      <main className="mktVersionMain">
        <p className="mktKicker">Build manifest</p>
        <h1>Version</h1>
        <p className="mktVersionLead">
          Deployed build metadata for VX-27. Commit and build time are captured when
          the site is exported.
        </p>

        <dl className="mktVersionGrid">
          {ROWS.map((row) => (
            <div key={row.label} className="mktVersionRow">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <section className="mktVersionHistory" aria-labelledby="version-history-heading">
          <p className="mktKicker">Release log</p>
          <h2 id="version-history-heading">Version history</h2>
          <ol className="mktVersionHistoryList">
            {VERSION_HISTORY.map((release) => {
              const isCurrent = release.version === currentReleaseVersion;
              return (
                <li
                  key={release.version}
                  className={`mktVersionRelease${isCurrent ? " mktVersionReleaseCurrent" : ""}`}
                >
                  <header className="mktVersionReleaseHead">
                    <div className="mktVersionReleaseMeta">
                      <span className="mktVersionReleaseTag">v{release.version}</span>
                      {isCurrent ? (
                        <span className="mktVersionReleaseBadge">Current</span>
                      ) : null}
                    </div>
                    <time dateTime={release.date}>{formatReleaseDate(release.date)}</time>
                  </header>
                  <h3>{release.title}</h3>
                  <p className="mktVersionReleaseCommit">
                    <code>{release.commit}</code>
                  </p>
                  <ul>
                    {release.changes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mktVersionCommits" aria-labelledby="commit-log-heading">
          <p className="mktKicker">Git log</p>
          <h2 id="commit-log-heading">Complete commit history</h2>
          <p className="mktVersionLead mktVersionLeadCompact">
            Auto-generated from <code>git log</code>
            {gitCommitHistory.count ? ` · ${gitCommitHistory.count} commits` : ""}
            {gitCommitHistory.generatedAt
              ? ` · snapshot ${formatBuildTime(gitCommitHistory.generatedAt)}`
              : ""}
            .
          </p>
          <ol className="mktVersionCommitList">
            {gitCommitHistory.commits.map((entry) => {
              const isHead = shaMatches(entry.sha, BUILD.gitSha);
              const release = RELEASE_BY_COMMIT[entry.sha];
              const isWip = /^wip$/i.test(entry.subject.trim());
              return (
                <li
                  key={entry.sha}
                  className={[
                    "mktVersionCommit",
                    isHead ? "mktVersionCommitHead" : "",
                    isWip ? "mktVersionCommitWip" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="mktVersionCommitMeta">
                    <code>{entry.sha}</code>
                    <time dateTime={entry.date}>{formatReleaseDate(entry.date)}</time>
                    {release ? (
                      <span className="mktVersionCommitRelease">v{release}</span>
                    ) : null}
                    {isHead ? (
                      <span className="mktVersionReleaseBadge">HEAD</span>
                    ) : null}
                  </div>
                  <p>{entry.subject}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <p className="mktVersionNote">
          Prototype · solo build ·{" "}
          <Link href="/credits">credits</Link>
        </p>
      </main>

      <footer className="mktFooter">
        <p>© VX-27</p>
        <div className="mktFooterLinks">
          <Link href="/">Home</Link>
          <Link href="/game">Play</Link>
          <Link href="/credits">Credits</Link>
        </div>
      </footer>
    </div>
  );
}
