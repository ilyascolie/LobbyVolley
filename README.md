# LobbyVolley

Civic action tool that turns a ZIP code and a cause into personalized physical letters to every elected representative, federal and state, and mails them via PostGrid.
## Outstanding to-dos

**Component decomposition.** `home.tsx` (641 lines) holds the pipeline orchestration alongside UI state. The ~180-line `runPipeline` function belongs in a custom hook. `send-screen.tsx` (723 lines) packs the send modal, PostGrid logic, letter editing, and layout switching into one file. Breaking these apart would improve testability and readability.

**Community campaigns.** Allow users to publish campaigns that others can discover and contribute to. A shared cause page where joining pre-fills the subject and reps, and each new participant adds their own volley of letters. This turns the tool from single-user into a coordinated advocacy platform.

**LLM response caching.** Representative data and bill research don't change hour-to-hour, but every pipeline run makes fresh Sonar calls. A cache layer (keyed on ZIP + cause) would cut API costs significantly and make repeat runs near-instant. Stale-while-revalidate with a TTL of ~24 hours would balance freshness with speed.

**First-party data sources.** Use the Google Civic Information API or congress.gov API for representative data instead of relying solely on LLM responses. The current approach works but every data point is only as reliable as the model's training data. A hybrid approach (structured APIs for facts, LLMs for synthesis) would give the best of both.

**Testing.** Schema validation, the JSON parsing fallback chain, and the format/fallback utility functions are all pure and testable. Integration tests for the pipeline phases (mocking Sonar/Claude responses) would catch regressions in the most complex code path.

## How It Works

1. **Enter ZIP + cause**: user provides their address and describes the issue they care about
2. **AI pipeline runs**: the app looks up all reps, enriches their profiles, finds relevant legislation, and generates tailored letters
3. **Review & send**: user edits letters if needed, then mails physical copies through PostGrid with one click

## Architecture

```
Client (React + Vite)          Server (Express)           External APIs
─────────────────────          ────────────────           ─────────────
                                                          
ZIP + cause ──────────► /api/sonar ──────────────────────► Perplexity Sonar
                        (rep lookup, enrichment,            (real-time web search)
                         stance analysis)                 
                                                          
cause + reps ─────────► /api/bills/search ───────────────► Anthropic Claude Haiku
                        /api/letter/batch                   (bill research, letter writing)
                                                          
letters ──────────────► /api/postgrid/send ──────────────► PostGrid
                        (physical mail delivery)            (print + mail API)
```

**No database.** All state lives in the React client during a session. The server is a stateless proxy that keeps API keys off the client.

## AI Pipeline Detail

The enrichment pipeline runs 5+ parallel Sonar queries per representative:

| Query | Purpose |
|-------|---------|
| Rep lookup | Parse ZIP into full rep list (name, party, chamber, state, district) |
| Bio + committees | Background context for letter personalization |
| Contact + photo | Office addresses, phone, website, headshot URL |
| Challenger info | Electoral context |
| Stance on issue | How the rep has voted/spoken on the user's cause |
| Office addresses | Physical mailing addresses for PostGrid |

Claude Haiku handles bill search (finding relevant active legislation) and letter generation (one personalized letter per rep, referencing their specific jurisdiction, party, and any relevant bills).

## Project Structure

```
client/
  src/
    components/       # UI screens: choose, start, campaign-loader, send, rep-panel
    components/ui/    # Primitives: button, input, textarea, badge, switch, scroll-area, card
    lib/api.ts        # All API calls + Sonar query builders + enrichment logic
    pages/home.tsx    # Main page, orchestrates the 4-screen flow
shared/
  schema.ts           # Zod schemas + TypeScript types (no DB tables)
  utils.ts            # JSON parsing helper
server/
  routes.ts           # 5 endpoints: health, sonar proxy, bills, letters, postgrid
  index.ts            # Express setup + request logging
  vite.ts             # Vite dev server middleware
  static.ts           # Production static file serving
```

~3,800 lines of application code across 24 files.

## Design Decisions

**AI as the data layer.** Representative data, office addresses, bill research, and letter content all come from LLM queries (Perplexity Sonar for factual lookups, Claude Haiku for generation). This avoids integrating multiple government APIs (Google Civic API, congress.gov, OpenStates) at the cost of data reliability. The `parseJsonSafe` utility in `shared/utils.ts` handles the inherent fragility of parsing structured data from LLM responses with a fallback chain (try JSON, then regex for arrays, then regex for objects).

**Perplexity Sonar for rep lookup instead of a civic API.** Sonar returns richer, more current data than static databases, and handles edge cases (state legislators, redistricting) without maintaining a separate data pipeline.

**Claude Haiku for letter generation.** Fast and cheap enough to generate 10+ letters per session without noticeable latency or cost concerns.

**Server as API proxy.** All AI/mail API keys stay server-side. The client never touches credentials. Provides a single point for rate limiting and error handling.

**Typed throughout.** State variables, component props, and function signatures use TypeScript types derived from Zod schemas in `shared/schema.ts`. The shared schema is the single source of truth for data shapes across client and server.

**No database.** The app is stateless by design. Each session runs the full pipeline from scratch. This keeps the stack simple (no migrations, no connection pools, no ORM) at the cost of not persisting campaigns across sessions.

## Setup

```bash
git clone https://github.com/<your-username>/lobbyvolley.git
cd lobbyvolley
npm install
cp .env.example .env
# Fill in your API keys in .env
npm run dev
# App runs on http://localhost:5000
```

### Required API Keys

| Key | Service | Purpose |
|-----|---------|---------|
| `PERPLEXITY_API_KEY` | [Perplexity](https://docs.perplexity.ai) | Rep lookup, enrichment, stance analysis via Sonar |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com) | Bill search + letter generation via Claude Haiku |
| `POSTGRID_API_KEY` | [PostGrid](https://www.postgrid.com) | Physical mail delivery (use `test_sk_...` for sandbox) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload (port 5000) |
| `npm run build` | Bundle client (Vite) + server (esbuild) into `dist/` |
| `npm start` | Run production build |
| `npm run check` | TypeScript type check |

