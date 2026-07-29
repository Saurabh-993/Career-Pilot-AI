// Job sources — free, keyless APIs. Every fetcher returns NormalizedJob[].
// Each source can fail independently (Promise.allSettled upstream): one dead
// API never breaks the page — the manual paste fallbacks always exist.
import * as cheerio from "cheerio";

const htmlToText = (html = "") => cheerio.load(html).text().replace(/\s+/g, " ").trim();

// --- Remotive: https://remotive.com/api/remote-jobs?search=... ---
export async function fetchRemotive(query, limit = 12) {
  const res = await fetch(
    `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=${limit}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`Remotive ${res.status}`);
  const data = await res.json();
  return (data.jobs ?? []).map((j) => ({
    role: j.title ?? "",
    company: j.company_name ?? "",
    location: j.candidate_required_location ?? "",
    remote: true, // Remotive is remote-only
    seniority: "",
    salary: j.salary || null,
    skills: j.tags ?? [],
    applyUrl: j.url ?? "",
    source: "remotive",
    postedAt: j.publication_date ?? null,
    _description: htmlToText(j.description).slice(0, 1500), // for AI skill extraction if tags empty
  }));
}

// --- Arbeitnow: https://www.arbeitnow.com/api/job-board-api ---
export async function fetchArbeitnow(query) {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Arbeitnow ${res.status}`);
  const data = await res.json();
  const q = query.toLowerCase();
  return (data.data ?? [])
    .filter(
      (j) =>
        j.title?.toLowerCase().includes(q) ||
        (j.tags ?? []).some((t) => t.toLowerCase().includes(q))
    )
    .slice(0, 12)
    .map((j) => ({
      role: j.title ?? "",
      company: j.company_name ?? "",
      location: j.location ?? "",
      remote: !!j.remote,
      seniority: "",
      salary: null,
      skills: j.tags ?? [],
      applyUrl: j.url ?? "",
      source: "arbeitnow",
      postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
      _description: htmlToText(j.description).slice(0, 1500),
    }));
}

// --- RemoteOK: https://remoteok.com/api (free, keyless; fresher-friendly tags) ---
export async function fetchRemoteOK(query) {
  const res = await fetch("https://remoteok.com/api", {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "Mozilla/5.0 (CareerPilot)" },
  });
  if (!res.ok) throw new Error(`RemoteOK ${res.status}`);
  const data = await res.json();
  const q = query.toLowerCase();
  return (Array.isArray(data) ? data.slice(1) : []) // first element is metadata
    .filter(
      (j) =>
        j.position?.toLowerCase().includes(q) ||
        (j.tags ?? []).some((t) => String(t).toLowerCase().includes(q))
    )
    .slice(0, 12)
    .map((j) => ({
      role: j.position ?? "",
      company: j.company ?? "",
      location: j.location || "Worldwide",
      remote: true,
      seniority: "",
      salary: j.salary_min ? `$${j.salary_min}+` : null,
      skills: (j.tags ?? []).map(String),
      applyUrl: j.url ?? "",
      source: "remoteok",
      postedAt: j.date ?? null,
      _description: htmlToText(j.description ?? "").slice(0, 1500),
    }));
}

// --- Jobicy: https://jobicy.com/api/v2/remote-jobs (free, keyless, has jobLevel) ---
export async function fetchJobicy(query) {
  const res = await fetch(
    `https://jobicy.com/api/v2/remote-jobs?count=15&tag=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`Jobicy ${res.status}`);
  const data = await res.json();
  return (data.jobs ?? []).map((j) => ({
    role: j.jobTitle ?? "",
    company: j.companyName ?? "",
    location: j.jobGeo ?? "",
    remote: true,
    seniority: j.jobLevel ?? "",
    salary: null,
    skills: [],
    applyUrl: j.url ?? "",
    source: "jobicy",
    postedAt: j.pubDate ?? null,
    _description: htmlToText(j.jobExcerpt ?? "").slice(0, 1500),
  }));
}

// --- Company selector: Greenhouse + Lever host official public job JSON for
//     thousands of tech companies. We guess the board slug from the name. ---
export async function fetchCompanyBoards(companyName) {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const jobs = [];

  const attempts = await Promise.allSettled([
    fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, {
      signal: AbortSignal.timeout(10000),
    }).then(async (r) => {
      if (!r.ok) throw new Error("no greenhouse board");
      const d = await r.json();
      return (d.jobs ?? []).slice(0, 15).map((j) => ({
        role: j.title ?? "",
        company: companyName,
        location: j.location?.name ?? "",
        remote: /remote/i.test(j.location?.name ?? ""),
        seniority: "",
        salary: null,
        skills: [],
        applyUrl: j.absolute_url ?? "",
        source: "greenhouse",
        postedAt: j.updated_at ?? null,
        _description: htmlToText(j.content ?? "").slice(0, 1500),
      }));
    }),
    fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
      signal: AbortSignal.timeout(10000),
    }).then(async (r) => {
      if (!r.ok) throw new Error("no lever board");
      const d = await r.json();
      if (!Array.isArray(d)) throw new Error("no lever board");
      return d.slice(0, 15).map((j) => ({
        role: j.text ?? "",
        company: companyName,
        location: j.categories?.location ?? "",
        remote: /remote/i.test(j.categories?.location ?? ""),
        seniority: "",
        salary: null,
        skills: [],
        applyUrl: j.hostedUrl ?? "",
        source: "lever",
        postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        _description: htmlToText(j.descriptionPlain ?? j.description ?? "").slice(0, 1500),
      }));
    }),
  ]);

  for (const a of attempts) if (a.status === "fulfilled") jobs.push(...a.value);
  if (!jobs.length)
    throw Object.assign(
      new Error(
        `"${companyName}" doesn't publish jobs on Greenhouse/Lever (big companies like Microsoft use locked career portals). Paste a job link from their careers page instead — that always works.`
      ),
      { status: 404 }
    );
  return jobs;
}

// --- Scrape a single job page the user pasted a link to ---
export async function scrapeJobPage(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "Mozilla/5.0 (CareerPilot; job-analysis)" },
  });
  if (!res.ok) throw Object.assign(new Error(`Could not fetch that page (HTTP ${res.status})`), { status: 422 });
  const $ = cheerio.load(await res.text());
  $("script, style, nav, footer, header").remove(); // strip page chrome
  const title = $("title").text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 7000);
  if (text.length < 200)
    throw Object.assign(
      new Error("That page returned almost no text (likely rendered by JavaScript). Paste the JD text instead."),
      { status: 422 }
    );
  return { title, text };
}
