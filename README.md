# React Query — Learning Project

A full-stack practice app for learning **TanStack React Query** (`@tanstack/react-query`) — a **server-state management** library for fetching, caching, syncing, and mutating API data in React.  
Backend serves dummy products (in-memory); frontend fetches, searches, caches, debounces, and adds products via mutations.

---

## Project Structure

```
react-query/
├── backend/          # Express API (port 3000)
│   └── index.js      # GET /api/products + POST /api/products + optional ?search=
└── frontend/         # React + Vite (port 5173)
    └── src/
        ├── main.jsx  # QueryClientProvider + React Query DevTools
        └── App.jsx   # useQuery + useMutation + search + debounce + enabled
```

---

## How to Run

**Terminal 1 — Backend**
```bash
cd backend
npm install
npm run start
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` → `http://localhost:3000`.

---

## Learning Journal

| Date | Focus | Progress | Status |
|------|-------|----------|--------|
| **11–15 June 2026** | `useQuery`, caching, debounce, mutations, DevTools, `enabled` | **~55% overall** / **~85% fundamentals** | ✅ Learned |

**Quick jump:** [Learned](#-learned) · [Not learned yet](#-not-learned-yet)

---

## ✅ Learned

> Built the app, replaced manual `useEffect` fetching with React Query, learned caching deeply, added **mutations** and **cache invalidation**, used **DevTools** to visualize cache states, and added **`enabled`** for conditional fetching.

### What We Built

### Backend
- Express server with `GET /api/products` and `POST /api/products`
- Product names, prices, and images from [fakestoreapi.com](https://fakestoreapi.com) style data
- Shared in-memory `products` array (module-level) — both GET and POST read/write the same list
- `express.json()` middleware to parse POST request bodies
- Optional search filter: `/api/products?search=jacket`
- 3 second artificial delay on full list (`setTimeout`) to simulate slow API
- POST validates `name`, `price`, `image`; returns `201` with new product (`id` via `Date.now()`)

### Frontend (before React Query)
We started with the manual approach:
- `useState` for `products`, `loading`, `error`, `search`
- `useEffect` + `axios` to fetch data
- `AbortController` to cancel stale requests on search change or unmount

### Frontend (with React Query)
Replaced most of that boilerplate with `useQuery`.

### React Query — Steps Completed

### Step 1 — Setup
- Installed `@tanstack/react-query`
- Wrapped app in `QueryClientProvider` in `main.jsx`

```jsx
const queryClient = new QueryClient()

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

### Step 2 — First `useQuery`
- Replaced `useEffect` fetch with `useQuery`
- Used `data`, `isLoading`, `isError` for UI states

```jsx
useQuery({
  queryKey: ['products'],
  queryFn: () => axios.get('/api/products').then((res) => res.data),
})
```

### Step 3 — Basic UI
- Show loading / error / product list
- No manual `setProducts`, `setLoading`, `setError` needed

### Step 4 — Search with `queryKey`
- Added `search` state
- Put search in the query key so each search term is cached separately

```jsx
queryKey: ['products', search]
queryFn: () => axios.get(`/api/products?search=${search}`).then((res) => res.data)
```

**Key idea:** `queryKey` is a unique cache ID (like a path: `products / "jacket"`). When it changes, React Query fetches again and cancels the old request automatically.

### Step 5 — Loading states (`isLoading` vs `isFetching`)
| State | Meaning |
|-------|---------|
| `isLoading` | First fetch, no data yet |
| `isFetching` | Any request in flight (first load or refetch) |
| `isError` | Request failed |

Added `keepPreviousData` so the product list stays visible while a new search loads:

```jsx
placeholderData: keepPreviousData
```

### Step 6 — Caching (`staleTime` + `gcTime`)

```jsx
staleTime: 1000 * 60 * 5,  // 5 minutes
gcTime: 1000 * 60 * 10,    // 10 minutes
```

| | `staleTime` | `gcTime` |
|---|-------------|----------|
| **Question it answers** | Can I trust this cache without refetching? | How long do I keep **unused** cache in memory? |
| **While fresh** | No API call — serve cache (**Fresh**) | (query may be active or inactive) |
| **When expired** | Data marked **stale** — still in memory | Timer runs only when query is **inactive** |
| **Then what?** | Refetch only when **stale + trigger** | After timer → cache **deleted forever** |

- **`staleTime`** — *"Should I refetch?"* For 5 min, data is **fresh** → no API call on revisit. After 5 min → **stale** (outdated, not trusted) but **still shown from memory** until a refetch completes.
- **`gcTime`** — *"Should I delete this from memory?"* Timer starts only when **no component uses that `queryKey`** (query becomes **Inactive**). After 10 min unused → entry removed. Next same search = full fetch like the first time.

**Why both?** They do different jobs — `staleTime` does NOT replace `gcTime`.

**Major tweak — `gcTime` is NOT what keeps stale data in memory:**
- Stale data stays in memory simply because React Query hasn't deleted it yet.
- **`gcTime` only counts down when the query is Inactive** (zero observers).
- If you **stay on the same search** for 2 hours, that cache entry stays in memory the whole time (even if stale) — `gcTime` does **not** wipe it while the query is **active**.

```
ACTIVE query ['products', 'mens']  →  stays in memory (fresh OR stale)
                                   →  gcTime timer NOT running

Switch to ['products', '']         →  'mens' becomes INACTIVE
                                   →  gcTime 10 min timer STARTS
                                   →  after 10 min → deleted from memory
```

**Full lifecycle** (`staleTime: 5 min`, `gcTime: 10 min`):

```
FETCH → cache → FRESH (0–5 min) → no API on revisit, show cache

5 min → STALE (still in memory, UI still shows old data)
      → NO automatic refetch — only when stale + TRIGGER

Triggers (mostly automatic, not only "manual"):
  • Search same term again (query active + stale)
  • Tab focus (refetchOnWindowFocus)
  • invalidateQueries (after add product)
  • Network reconnect
  • DevTools refetch button (manual)
  • F5 hard reload → entire cache cleared → brand-new fetch (not a "stale refetch")

STALE + trigger → REFETCH → FRESH again

Leave search "mens" → INACTIVE → gcTime 10 min starts
  • While inactive: no API calls just for sitting in cache
  • Revisit before gcTime + still fresh → no API call
  • Revisit before gcTime + stale → refetch
After gcTime → DELETED → same search = new full fetch
```

**Example walkthrough:**
1. Search `jacket` → `mens` → `jacket` within 5 min → no API call (still fresh)
2. Search `jacket` after 7 min → stale → refetch on trigger (revisit / tab focus), old rows may show first
3. Search `mens`, then clear search → `mens` inactive; after 10 min unused → cache gone → next `mens` = full load

Without `gcTime`, every old search (`jacket`, `mens`, `ssd`…) would stay in memory forever.

**Note:** Use `1000` (ms), not `10000`.

**One-line summary:** `staleTime` = trust cache. **Stale** = don't trust, refetch on triggers. **`gcTime`** = how long **unused** cache survives before deletion.

### Step 7 — Debounced search
Typing `j-a-c-k-e-t` without debounce = 6+ API calls.  
With debounce, only **1 call** after user stops typing.

```jsx
const [search, setSearch] = useState('')           // input value (instant)
const [debouncedSearch, setDebouncedSearch] = useState('')  // used in queryKey

useEffect(() => {
  const timeoutId = setTimeout(() => setDebouncedSearch(search), 500)
  return () => clearTimeout(timeoutId)
}, [search])

queryKey: ['products', debouncedSearch]
```

### Step 8 — `POST /api/products` (backend write endpoint)

Mutations need a real API endpoint that **changes** server data. Added:

```js
app.use(express.json())

let products = [ /* shared array — outside route handlers */ ]

app.post("/api/products", (req, res) => {
  const { name, price, image } = req.body
  // validate → build newProduct → products.push(newProduct) → res.status(201).json(newProduct)
})
```

**Key idea:** The `products` array must live **outside** `GET` and `POST` so both routes share the same data. If it stays inside `GET` only, `POST` cannot push to it.

### Step 9 — `useMutation` + Add Product form

| Hook | Purpose | When it runs |
|------|---------|--------------|
| `useQuery` | **Read** server data | Automatically on mount / when `queryKey` changes |
| `useMutation` | **Write** server data | Only when **you** call `mutate()` (e.g. form submit) |

```jsx
const addProductMutation = useMutation({
  mutationFn: (newProduct) =>
    axios.post('/api/products', newProduct).then((res) => res.data),
})

// on submit:
addProductMutation.mutate({ name, price: Number(price), image })
```

**Mutation UI states:**

| State | Meaning |
|-------|---------|
| `isPending` | POST in flight — disable button, show "Adding..." |
| `isSuccess` | POST succeeded |
| `isError` | POST failed (e.g. missing fields → 400) |

Form fields (`name`, `price`, `image`) are **client state** (`useState`). The product list remains **server state** (`useQuery`).

### Step 10 — `invalidateQueries` (sync cache after mutation)

**Problem we hit:** Backend changed (fewer products, or new product added) but UI still showed old count — React Query was serving **cached** data within `staleTime`. `useMutation` alone does **not** refresh the list.

**Fix:** After a successful POST, tell React Query the products cache is outdated:

```jsx
const queryClient = useQueryClient()

const addProductMutation = useMutation({
  mutationFn: (newProduct) =>
    axios.post('/api/products', newProduct).then((res) => res.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    setName('')
    setPrice('')
    setImage('')
  },
})
```

**What `invalidateQueries` does:**
1. Marks all queries whose key **starts with** `['products']` as stale (`['products', '']`, `['products', 'jacket']`, etc.)
2. Refetches active queries from the API
3. Updates cache and re-renders components

**Flow after add product:**

```
User submits form → POST /api/products → backend pushes to array
       → onSuccess → invalidateQueries(['products'])
       → GET /api/products refetches → UI shows new count + product
```

Even with a long `staleTime`, **invalidate forces a refetch** because we know the server changed.

| Approach | When to use |
|----------|-------------|
| Lower `staleTime` | Data changes often; ok refetching on revisit |
| `invalidateQueries` | **You know** data changed (after create/update/delete) |

Production apps typically use **both**.

### Step 11 — React Query DevTools

Installed `@tanstack/react-query-devtools` and added to `main.jsx`:

```jsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

DevTools are a **debug window** into the in-memory cache — they don't change app behavior. Put them in `main.jsx` (next to `QueryClientProvider`) so the whole app is visible.

**Five query statuses in DevTools:**

| Status | Meaning | How we tested it |
|--------|---------|------------------|
| **Fresh** | Active query, data within `staleTime` | Load page or finish a fetch |
| **Fetching** | API request in flight | Add product, new search, or DevTools refetch |
| **Stale** | Data in memory but no longer trusted | `invalidateQueries`, DevTools invalidate, or `staleTime: 0` |
| **Inactive** | Cached but no component using this `queryKey` | Search `mens` then switch to `''` — old keys stay in cache |
| **Paused** | Fetch blocked (usually offline) | DevTools offline toggle → search new term |

**DevTools ties to Step 6:** Use the panel to watch **Fresh → Fetching → Stale → Inactive** in real time. See [Step 6](#step-6--caching-staletime--gctime) for the full `staleTime` / `gcTime` / trigger mental model.

### Step 12 — `enabled` (conditional fetching)

**Problem:** Debounce reduces calls while typing, but a 2-character search like `me` still hits the API after the user stops typing — often too early and wasteful.

**Fix:** `enabled` tells React Query **whether to run** `queryFn` at all.

```jsx
enabled: debouncedSearch.length === 0 || debouncedSearch.length > 2,
```

| `debouncedSearch` | `enabled` | What happens |
|-------------------|-----------|--------------|
| `''` (empty) | `true` | Fetch full product list (initial load) |
| `'me'` (1–2 chars) | `false` | **No API call** — query is idle |
| `'men'` (3+ chars) | `true` | Fetch `/api/products?search=men` |

**Key idea:** `enabled: false` ≠ loading. The query is **paused** — `isFetching` stays `false`, and `data` can be `undefined` for that `queryKey`.

**UI changes required:**
- `isSearchTooShort` — detect 1–2 character searches and show *"Type at least 3 characters to search"*
- Safe rendering — `data?.length` and `data?.map` so the app doesn't crash when `enabled` is `false`
- Hide product list while search is too short (`!isSearchTooShort`)

```jsx
const isSearchTooShort = debouncedSearch.length > 0 && debouncedSearch.length <= 2

{isSearchTooShort && <p>Type at least 3 characters to search</p>}

{!isSearchTooShort && (
  <>
    <h2>number of products: {data?.length ?? 0}</h2>
    {data?.map((product) => ( ... ))}
  </>
)}
```

**How we tested:**
1. Empty search → full list loads (3s delay)
2. Type `me` → no fetch after debounce; short-search message shows
3. Type `men` → fetch runs; filtered products appear
4. DevTools → no request for `['products', 'me']`; request for `['products', 'men']`

**`enabled` vs debounce:**

| Tool | Job |
|------|-----|
| **Debounce** | Wait until user **stops typing** before updating `debouncedSearch` |
| **`enabled`** | Decide **if** a fetch should run for the current `debouncedSearch` |

Use both together: debounce avoids rapid key changes; `enabled` blocks fetches that aren't meaningful yet.

**Also fixed in Step 6:** `staleTime` / `gcTime` multiplier — use `1000 * 60 * 5` (5 min), not `10000 * 60 * 5` (~50 min). Same for `gcTime`: `1000 * 60 * 10` = 10 min.

### What is Server State Management?

React Query is a **server-state management** library. That name is easy to misread.

> It does **not** manage state **on** the server.  
> It manages **server data inside your React app** — fetching, caching, syncing, and sharing it.

### What is "server state"?

Data that **lives on the backend** but your UI needs a **local copy** of:

```json
{ "id": 1, "name": "Fjallraven Backpack", "price": 109.95 }
```

When your app runs `axios.get('/api/products')`, you get a copy in the browser. That copy is **server state** because:

| Property | Meaning |
|----------|---------|
| **Source of truth** | The server / database — not your React component |
| **Can change outside your app** | Admin adds products, another user edits data |
| **Can become stale** | Your UI may show old data until you refetch |
| **Needs synchronization** | App must fetch, cache, and refresh over time |

In this project, our **products list** is server state. **`search` input text** is client state (only exists in the browser until you send it to the API).

### Manual way vs React Query

**Without React Query** — you own everything:

```jsx
const [products, setProducts] = useState([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState(false)

useEffect(() => {
  fetch('/api/products').then(...)
}, [])
```

You manually handle: loading, error, caching, refetching, stale data, cancellation.

**With React Query** — data lives in a **query cache**:

```jsx
const { data: products } = useQuery({
  queryKey: ['products', debouncedSearch],
  queryFn: () => axios.get(`/api/products?search=${debouncedSearch}`).then(res => res.data),
})
```

Internally (simplified):

```
React Query Cache
└── ['products', '']
│   └── [ 20 products... ]
└── ['products', 'jacket']
    └── [ 3 jacket products... ]
```

Components **read from this cache** instead of juggling their own `useState` for API data.

### What state does React Query manage?

It's called "state management" because it tracks all of this for you:

| State | Example in our app |
|-------|-------------------|
| `data` | Product list array |
| `isLoading` | First load, no products yet |
| `isFetching` | Refetching after search change |
| `isError` | API failed |
| `isStale` | Cache older than `staleTime` |
| Cache / freshness | `staleTime`, `gcTime` |

```jsx
const { data, isLoading, isError, isFetching, isStale } = useQuery(...)
```

No manual `setProducts`, `setLoading`, `setError`.

### Sharing data across components (one request)

**Without React Query** — duplicate fetches:

```
<Navbar />   → GET /api/user  (Request #1)
<Profile />  → GET /api/user  (Request #2)
```

**With React Query** — same `queryKey` = shared cache:

```
useQuery({ queryKey: ['user'], queryFn: fetchUser })  // in Navbar
useQuery({ queryKey: ['user'], queryFn: fetchUser })  // in Profile

        Request #1
             ↓
    React Query Cache
       ↙         ↘
   Navbar     Profile
```

One network call, both components stay in sync. Same idea applies if two components both use `queryKey: ['products']`.

### When server data changes (`useMutation` + invalidate) — hands-on ✅

Implemented in Steps 9–10. After adding a product, `invalidateQueries` refetches the list — no manual "fetch again and pass data around."

### React Query vs Redux / Zustand

| Tool | Manages | Examples |
|------|---------|----------|
| **Redux / Zustand** | **Client state** | theme, sidebar open, modal open, selected tab |
| **React Query** | **Server state** | products, users, orders, notifications |

They solve different problems. Common real-world setup:

```
React Query  →  API / database data
Zustand      →  UI-only state
```

### Mental model

```
Backend API  (source of truth)
      ↓
React Query Cache  (client-side copy + lifecycle)
      ↓
React Components  (read data, show UI)
```

**React Query's job:**
- Fetch server data
- Cache it (client-side)
- Keep it fresh (`staleTime`, refetch, invalidate)
- Share it between components
- Sync after mutations

That's why it's a **server-state** library — it manages the **lifecycle of data that comes from the server**, not the server itself.

### Important Concepts Learned

### `queryKey` vs `queryFn`
- **`queryKey`** — *which* cache slot (label / path)
- **`queryFn`** — *how* to fetch data for that slot

### React Query cache vs HTTP `304`
| | React Query cache | HTTP 304 |
|---|-------------------|----------|
| Where | In-memory (client) | Browser / server |
| Network request | **None** when cache hit | Request still sent |
| When it helps | Revisit same search term | Server says "not modified" |

### Client-side cache — NOT server-side
`staleTime` / `gcTime` cache data in the **user's browser** (React Query memory). The backend does not know about it. This is **not** Redis/CDN/server caching.

### Master checklist — is your `staleTime` / `gcTime` concept clear?

Use this to sanity-check your understanding (validated in session):

| Statement | True? |
|-----------|-------|
| Within **5 min `staleTime`** → no API call, show cache | ✅ Yes |
| After **`staleTime`** → data is **stale** (outdated) but **still in memory** | ✅ Yes |
| **`gcTime` keeps stale data in memory** | ❌ No — stale data stays until deleted; `gcTime` only cleans **inactive** entries |
| **`gcTime` timer runs while query is active** | ❌ No — timer starts only when query is **Inactive** (no observers) |
| **Refetch after stale = only manual actions** | ❌ No — many triggers are **automatic** (tab focus, revisit search, `invalidateQueries`) |
| **F5 hard reload** | Clears entire cache → new fetch (not the same as "stale refetch") |
| **After `gcTime` on inactive query** → cache deleted → same search = full new fetch | ✅ Yes |
| **Inactive cache** → no API calls while just sitting unused | ✅ Yes |
| **Revisit inactive + fresh + within `gcTime`** → no API call | ✅ Yes |

### Same query + `staleTime` behavior
For the **same** `queryKey` (e.g. `['products', 'jacket']`):

| When | What happens |
|------|----------------|
| Within `staleTime` | No API call — UI uses cached data (**Fresh**) |
| After `staleTime` (still active) | **Stale** — still in memory; no refetch until a **trigger** |
| Revisit while stale | Often shows old cache first, then refetches and updates |
| Query inactive + past `gcTime` | Cache **gone** — next visit = fetch like first time |

**Stale data example:** User searches `jacket` → gets **5 rows** → cached. Admin adds 5 more on backend (**10 rows**). Within 5 min, user searches `jacket` again → **no API call** → UI still shows **5 rows**. After `staleTime` expires, next search refetches and shows 10 rows.

**We saw this live:** Editing the backend product list did not update the UI until hard refresh — the cache still held the old 20 products. Same root cause.

This is the **tradeoff**: better performance vs possibly outdated UI. Fix options:
- Shorter `staleTime` for data that changes often (e.g. `1000 * 30` = 30 sec)
- `queryClient.invalidateQueries({ queryKey: ['products'] })` after mutations ✅ (Step 10)

### What React Query replaced
| Manual (`useEffect`) | React Query |
|----------------------|-------------|
| `useState` for data/loading/error | `data`, `isLoading`, `isError` |
| `useEffect` for fetching | `useQuery` |
| `AbortController` cleanup | Built-in cancellation |
| No cache | Automatic per-`queryKey` cache |
| Manual POST + refetch list | `useMutation` + `invalidateQueries` |

### Progress snapshot (learned)

```
Fundamentals (useQuery, cache, keys)       █████████████████░░░  ~88%
Practical patterns (debounce, search)      █████████████████░░░  ~85%
Theory (server state, staleTime, gcTime)   ████████████████████  ~95%
Mutations & sync (useMutation, invalidate) ████████████░░░░░░░░  ~60%
DevTools & cache states (fresh/stale/…)    ██████████████░░░░░░  ~70%
Query tuning (enabled)                     ██████████░░░░░░░░░░  ~50%
Advanced (infinite, optimistic, suspense)  ░░░░░░░░░░░░░░░░░░░░  ~0%
```

**Solid foundation for reading, writing, and debugging server data.** Next up: global `defaultOptions` and advanced patterns (see [Not learned yet](#-not-learned-yet)).

---

## 📋 Not learned yet

> Pick up here when you're ready. The **Learned** section covers fundamentals through `enabled`; below is what’s still ahead — production tuning and advanced patterns.

### Priority checklist

- [ ] **Global `defaultOptions`** — set `staleTime` / `gcTime` once in `QueryClient` instead of per query

### Stretch goals (if time allows)

- [ ] **`prefetchQuery`** — preload products before user navigates to a page
- [ ] **Optimistic updates** — update UI instantly before API responds, rollback on error
- [ ] **`useInfiniteQuery`** — pagination / infinite scroll on product list
- [ ] **Retry & `refetchOnWindowFocus`** — tune production refetch behavior
- [ ] **Re-apply product store CSS** — polish the UI from earlier in the project

### Suggested learning order

1. Move `staleTime` / `gcTime` to global `QueryClient` `defaultOptions`
2. (Stretch) optimistic updates or infinite query

### Targets (when you learn this)

| Area | Now | Target |
|------|-----|--------|
| Overall React Query | ~55% | ~58% |
| Core fundamentals | ~85% | ~88% |
| Mutations & sync | ~60% | ~70% |
| Query tuning (defaults, prefetch) | ~25% | ~75% |

### Topics for later (beyond this section)

- Parallel queries / dependent queries
- `setQueryData` (manual cache updates)
- Suspense mode with React Query
- Testing queries with mock server

---

## References

- [React Query Overview (ChatGPT)](https://chatgpt.com/share/6a2aa4ab-7990-83a8-8605-6fa0f2f7e7d2) — basic concepts in React Query (companion notes for this project)

---

## Tech Stack
- **Frontend:** React 19, Vite, Axios, TanStack React Query v5, React Query DevTools
- **Backend:** Express 5, Node.js
