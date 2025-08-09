import React, { useEffect, useMemo, useState } from "react";

/**
 * Dummy SPA UI with hash-based routing only (no backend wiring).
 * Visual vibe inspired by sparka.ai — clean, airy, rounded, subtle depth.
 *
 * Copy/paste this file into a Next.js page (e.g., app/page.tsx) or a React sandbox.
 * For Next.js, remove hash routing and map routes to pages as needed.
 */

// -----------------------------
// Utilities (Hash Router)
// -----------------------------
function useHashRoute() {
  const [hash, setHash] = useState(
    typeof window !== "undefined" ? window.location.hash || "#/" : "#/"
  );

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const route = useMemo(() => hash.replace(/^#/, ""), [hash]);
  return [route, (r: string) => (window.location.hash = r)] as const;
}

// -----------------------------
// Layout Primitives
// -----------------------------
const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }>
  = ({ children, className = "", onClick }) => (
  <div
    onClick={onClick}
    className={`rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""} ${className}`}
  >
    {children}
  </div>
);

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  className?: string;
}> = ({ children, onClick, variant = "primary", className = "" }) => {
  const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all";
  const styles =
    variant === "primary"
      ? "bg-black text-white hover:bg-neutral-800"
      : variant === "outline"
      ? "border border-gray-300 hover:bg-gray-50"
      : "text-gray-700 hover:bg-gray-100";
  return (
    <button onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
};

// -----------------------------
// Nav
// -----------------------------
const Nav: React.FC<{ go: (r: string) => void; route: string }> = ({ go, route }) => (
  <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur">
    <Container className="flex h-16 items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-black" />
        <span className="text-sm font-semibold tracking-tight">AutoScope</span>
      </div>
      <nav className="hidden gap-6 md:flex">
        <a className={`text-sm ${route === "/" ? "font-semibold" : "text-gray-600"}`} href="#/">Home</a>
        <a className={`text-sm ${route.startsWith("/plan") ? "font-semibold" : "text-gray-600"}`} href="#/plan">Plan</a>
        <a className={`text-sm ${route.startsWith("/analysis") ? "font-semibold" : "text-gray-600"}`} href="#/analysis">Analysis</a>
        <a className={`text-sm ${route.startsWith("/history") ? "font-semibold" : "text-gray-600"}`} href="#/history">History</a>
      </nav>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => go("/login")}>Sign in</Button>
        <Button onClick={() => go("/plan")}>New Analysis</Button>
      </div>
    </Container>
  </header>
);

// -----------------------------
// Pages
// -----------------------------
function Home({ go }: { go: (r: string) => void }) {
  const quick = [
    { t: "Purchase Advice", s: "Get a quick buyer brief", r: "/analysis/purchase" },
    { t: "Running Cost", s: "Fuel/Energy, insurance, tax", r: "/analysis/running" },
    { t: "Reliability", s: "Common faults & recalls", r: "/analysis/reliability" },
    { t: "Compare", s: "Pick 2–3 listings to compare", r: "/plan?mode=compare" },
  ];

  return (
    <>
      <section className="border-b bg-gradient-to-b from-white to-gray-50 py-16">
        <Container className="grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-600">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Orchestrated agent prototype
            </div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Hello there!<br/>How can I help you today?</h1>
            <p className="mt-4 max-w-xl text-gray-600">
              Plan your target car, then run Purchase Advice, Running Cost, or Reliability analysis — all streamed in real time.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Button onClick={() => go("/plan")}>Start Planning</Button>
              <Button variant="ghost" onClick={() => go("/analysis/purchase")}>Try Purchase Advice</Button>
            </div>
          </div>
          <div className="lg:col-span-5">
            <Card className="p-4">
              <div className="aspect-[4/3] w-full rounded-xl bg-gray-100" />
              <div className="mt-3 text-sm text-gray-600">Preview mockup</div>
            </Card>
          </div>
        </Container>
      </section>

      <section className="py-10">
        <Container>
          <div className="mb-4 text-sm font-medium text-gray-700">Quick actions</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quick.map((q) => (
              <Card key={q.t} className="p-4" onClick={() => go(q.r)}>
                <div className="text-[15px] font-medium">{q.t}</div>
                <div className="text-sm text-gray-600">{q.s}</div>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

function Plan({ go }: { go: (r: string) => void }) {
  return (
    <Container className="py-12">
      <div className="mb-8">
        <div className="text-xs text-gray-600">Step 1 of 3</div>
        <h2 className="text-2xl font-semibold tracking-tight">Plan your analysis</h2>
        <p className="mt-1 text-gray-600">Enter a car model or upload a photo. We’ll suggest exact matches for you to confirm.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-4">
          <label className="text-sm font-medium">Car search</label>
          <div className="mt-2 flex gap-2">
            <input className="flex-1 rounded-xl border px-3 py-2" placeholder="e.g., 2020 Toyota Corolla Hybrid"/>
            <Button>Plan</Button>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium">Or upload image</label>
            <div className="mt-2 flex items-center justify-center rounded-xl border border-dashed p-6 text-gray-500">Drop image here</div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="text-sm font-medium">Planner progress</div>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 w-1/3 rounded-full bg-black" />
            </div>
            <div className="mt-2 text-xs text-gray-600">Analyzing query…</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium">Tips</div>
            <ul className="mt-2 list-disc pl-4 text-sm text-gray-600">
              <li>Add year and fuel type for better matches.</li>
              <li>Optional: link to a listing or upload a dash photo.</li>
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 text-sm font-medium">Suggested matches</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "2020 Corolla Hybrid Luna", spec: "Hatchback · AT · 90kW", price: "€18,900" },
            { title: "2020 Corolla Hybrid Sol", spec: "Hatchback · AT · 90kW", price: "€19,700" },
            { title: "2019 Corolla Hybrid Sport", spec: "Hatchback · AT · 90kW", price: "€17,800" },
          ].map((c) => (
            <Card key={c.title} className="p-4" onClick={() => go("/confirm") }>
              <div className="aspect-[4/3] w-full rounded-xl bg-gray-100" />
              <div className="mt-3 text-[15px] font-medium">{c.title}</div>
              <div className="text-sm text-gray-600">{c.spec}</div>
              <div className="mt-1 text-sm">Approx: {c.price}</div>
            </Card>
          ))}
        </div>
      </div>
    </Container>
  );
}

function Confirm({ go }: { go: (r: string) => void }) {
  return (
    <Container className="py-12">
      <div className="mb-8">
        <div className="text-xs text-gray-600">Step 2 of 3</div>
        <h2 className="text-2xl font-semibold tracking-tight">Confirm car</h2>
        <p className="mt-1 text-gray-600">We’ll use this exact spec for deeper analysis.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="aspect-[4/3] w-full rounded-xl bg-gray-100" />
            <div>
              <div className="text-lg font-medium">2020 Toyota Corolla Hybrid Luna</div>
              <div className="mt-1 text-sm text-gray-600">Hatchback · Automatic · 90 kW · FWD</div>
              <div className="mt-3 text-sm">Est. used price band: €17,800 – €19,700</div>
              <div className="mt-6 flex gap-2">
                <Button onClick={() => go("/analysis/purchase")}>Purchase Advice</Button>
                <Button variant="outline" onClick={() => go("/analysis/running")}>Running Cost</Button>
                <Button variant="outline" onClick={() => go("/analysis/reliability")}>Reliability</Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Quick edit</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <input className="rounded-xl border px-3 py-2" placeholder="Trim" defaultValue="Luna"/>
            <input className="rounded-xl border px-3 py-2" placeholder="Engine" defaultValue="1.8 Hybrid"/>
            <input className="rounded-xl border px-3 py-2" placeholder="Year" defaultValue="2020"/>
            <input className="rounded-xl border px-3 py-2" placeholder="Body" defaultValue="Hatchback"/>
          </div>
          <Button className="mt-3 w-full" variant="outline">Save changes</Button>
        </Card>
      </div>
    </Container>
  );
}

function AnalysisShell({ title }: { title: string }) {
  return (
    <Container className="py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-600">Step 3 of 3</div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Share</Button>
          <Button>Export PDF</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8 p-6">
          <div className="space-y-4">
            <div className="h-4 w-1/2 rounded bg-gray-100" />
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-5/6 rounded bg-gray-100" />
            <div className="h-4 w-3/4 rounded bg-gray-100" />
            <div className="h-4 w-2/3 rounded bg-gray-100" />
          </div>
          <div className="mt-6 text-sm text-gray-500">Streaming analysis placeholder…</div>
        </Card>

        <div className="lg:col-span-4 space-y-3">
          <Card className="p-4">
            <div className="text-sm font-medium">Sources</div>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="truncate text-gray-600">[1] Example source title — example.com</li>
              <li className="truncate text-gray-600">[2] Another source — docs.example.org</li>
              <li className="truncate text-gray-600">[3] Review aggregator — cars.example</li>
            </ul>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium">Next actions</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline">Add Running Cost</Button>
              <Button variant="outline">Add Reliability</Button>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
}

function AnalysisPurchase() { return <AnalysisShell title="Purchase Advice"/> }
function AnalysisRunning() { return <AnalysisShell title="Running Cost"/> }
function AnalysisReliability() { return <AnalysisShell title="Reliability"/> }

function History() {
  return (
    <Container className="py-12">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">History</h2>
        <p className="text-gray-600">Recent sessions saved to your account.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1,2,3].map(i => (
          <Card key={i} className="p-4" >
            <div className="aspect-[4/3] w-full rounded-xl bg-gray-100" />
            <div className="mt-3 text-[15px] font-medium">2020 Corolla Hybrid — Purchase Advice</div>
            <div className="text-sm text-gray-600">Jul 08, 2025</div>
          </Card>
        ))}
      </div>
    </Container>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t py-10">
      <Container className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="text-sm text-gray-600">© {new Date().getFullYear()} AutoScope</div>
        <div className="flex gap-4 text-sm text-gray-600">
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
        </div>
      </Container>
    </footer>
  );
}

// -----------------------------
// App Root
// -----------------------------
export default function App() {
  const [route, go] = useHashRoute();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Nav go={(r) => (window.location.hash = `#${r}`)} route={route} />
      {route === "/" && <Home go={(r) => (window.location.hash = `#${r}`)} />}
      {route.startsWith("/plan") && <Plan go={(r) => (window.location.hash = `#${r}`)} />}
      {route === "/confirm" && <Confirm go={(r) => (window.location.hash = `#${r}`)} />}
      {route === "/analysis" && <AnalysisPurchase />}
      {route === "/analysis/purchase" && <AnalysisPurchase />}
      {route === "/analysis/running" && <AnalysisRunning />}
      {route === "/analysis/reliability" && <AnalysisReliability />}
      {route === "/history" && <History />}
      <Footer />
    </div>
  );
}
