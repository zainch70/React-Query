# React Query — Learning Project

A full-stack practice app for learning **TanStack React Query** (`@tanstack/react-query`) — a **server-state management** library for fetching, caching, and syncing API data in React.  
Backend serves 20 dummy products; frontend fetches, searches, caches, and debounces requests.

---

## Project Structure

```
react-query/
├── backend/          # Express API (port 3000)
│   └── index.js      # GET /api/products + optional ?search=
└── frontend/         # React + Vite (port 5173)
    └── src/
        ├── main.jsx  # QueryClientProvider setup
        └── App.jsx   # useQuery + search + debounce
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
| **11 June 2026** | `useQuery`, caching, debounce, server state theory | **~38% overall** / **~65% fundamentals** | ✅ Done |
| **12 June 2026** | Mutations, DevTools, advanced patterns | Target: **~50% overall** / **~80% fundamentals** | 📋 Planned |

**Quick jump:** [11 June 2026](#-11-june-2026--day-1-completed) · [12 June 2026](#-12-june-2026--day-2-planned)

---

## 📅 11 June 2026 — Day 1 (Completed)

> First session. Built the app, replaced manual `useEffect` fetching with React Query, and learned caching deeply.

### What We Built

### Backend
- Express server with `GET /api/products`
- 20 real product names, prices, and images from [fakestoreapi.com](https://fakestoreapi.com)
- Optional search filter: `/api/products?search=jacket`
- 3 second artificial delay (`setTimeout`) to simulate slow API

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
| **Controls** | Is data still trustworthy? | Should we keep it in memory? |
| **While fresh / active** | No refetch needed | Cache stays available |
| **When expired** | Data goes stale → may refetch | Unused cache is deleted |

- **`staleTime`** — *"Should I refetch?"* Data is **fresh** for X time → no API call. After that, data is **stale** but can still sit in memory.
- **`gcTime`** — *"Should I delete this from memory?"* After you **leave** a query (no component using it), unused cache is kept for X time, then **removed**.

**Why both?** They do different jobs — `staleTime` does NOT replace `gcTime`.

| | `staleTime` | `gcTime` |
|---|-------------|----------|
| Controls | Freshness (trust data or refetch) | Memory cleanup |
| When it matters | Query is used or revisited | Query is **unused** |
| When expired | May refetch (old cache can still show first) | Cache **deleted** from memory |

**Example** (`staleTime: 5 min`, `gcTime: 10 min`):
1. Search `jacket` → `mens` → `jacket` within 5 min → no API call (still fresh)
2. Search `jacket` after 7 min → stale → refetches, but old rows may show first from cache
3. Never search `jacket` for 10+ min → cache removed → next `jacket` search = full load like first time

Without `gcTime`, every old search (`jacket`, `mens`, `ssd`…) would stay in memory forever.

**Note:** Use `1000` (ms), not `10000`.

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

### When server data changes (`useMutation` + invalidate)

When a user **updates** data (e.g. edit a product), you use `useMutation`. After success:

```jsx
queryClient.invalidateQueries({ queryKey: ['products'] })
```

React Query then:
1. Marks matching cache as **stale**
2. **Refetches** from the API
3. **Updates** the cache
4. **Re-renders** all components using that query

No manual "fetch again and pass data around."

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

### Same query + `staleTime` behavior
For the **same** `queryKey` (e.g. `['products', 'jacket']`):

| When | What happens |
|------|----------------|
| Within `staleTime` | No API call — UI uses cached data |
| After `staleTime` | Data is stale → API refetches (often shows old cache first, then updates) |

**Stale data example:** User searches `jacket` → gets **5 rows** → cached. Admin adds 5 more on backend (**10 rows**). Within 5 min, user searches `jacket` again → **no API call** → UI still shows **5 rows**. After `staleTime` expires, next search refetches and shows 10 rows.

This is the **tradeoff**: better performance vs possibly outdated UI. Fix options:
- Shorter `staleTime` for data that changes often (e.g. `1000 * 30` = 30 sec)
- `queryClient.invalidateQueries({ queryKey: ['products'] })` after admin updates

### What React Query replaced
| Manual (`useEffect`) | React Query |
|----------------------|-------------|
| `useState` for data/loading/error | `data`, `isLoading`, `isError` |
| `useEffect` for fetching | `useQuery` |
| `AbortController` cleanup | Built-in cancellation |
| No cache | Automatic per-`queryKey` cache |

### Day 1 — Progress snapshot (11 June 2026)

```
Fundamentals (useQuery, cache, keys)      ████████████████░░░░  ~80%
Practical patterns (debounce, search)     ██████████████░░░░░░  ~70%
Theory (server state, staleTime, gcTime)  ████████████████████  ~95%
Mutations & sync                          ██░░░░░░░░░░░░░░░░░░  ~10%
Advanced (infinite, optimistic, suspense) ░░░░░░░░░░░░░░░░░░░░  ~0%
```

**Solid foundation for reading/fetching data.** Biggest gap: writing/updating data (`useMutation`).

---

## 📅 12 June 2026 — Day 2 (Planned)

> Pick up here after a break. Goal: learn **mutations** and tools that make React Query production-ready.

### Priority checklist

- [ ] **`useMutation`** — POST / PUT / DELETE (e.g. add a product on backend + form in UI)
- [ ] **`invalidateQueries`** (hands-on) — after mutation success, refetch products list automatically
- [ ] **React Query DevTools** — install `@tanstack/react-query-devtools`, visualize cache live
- [ ] **`enabled`** — only fetch when condition is met (e.g. `search.length > 2`)
- [ ] **Global `defaultOptions`** — set `staleTime` / `gcTime` once in `QueryClient` instead of per query

### Stretch goals (if time allows)

- [ ] **`prefetchQuery`** — preload products before user navigates to a page
- [ ] **Optimistic updates** — update UI instantly before API responds, rollback on error
- [ ] **`useInfiniteQuery`** — pagination / infinite scroll on product list
- [ ] **Retry & `refetchOnWindowFocus`** — tune production refetch behavior
- [ ] **Re-apply product store CSS** — polish the UI from earlier in the project

### Suggested order for Day 2

1. Add `POST /api/products` on backend
2. Build "Add Product" form with `useMutation`
3. Call `queryClient.invalidateQueries({ queryKey: ['products'] })` on success
4. Install DevTools and watch cache update in real time
5. Try `enabled` or global `defaultOptions`

### Target after Day 2

| Area | Now (11 Jun) | Target (12 Jun) |
|------|--------------|-----------------|
| Overall React Query | ~38% | ~50% |
| Core fundamentals | ~65% | ~80% |
| Mutations & sync | ~10% | ~60% |

### Topics still for later (beyond 12 June)

- Parallel queries / dependent queries
- `setQueryData` (manual cache updates)
- Suspense mode with React Query
- Testing queries with mock server

---

## References

- [React Query Overview (ChatGPT)](https://chatgpt.com/share/6a2aa4ab-7990-83a8-8605-6fa0f2f7e7d2) — basic concepts in React Query (companion notes for this project)

---

## Tech Stack
- **Frontend:** React 19, Vite, Axios, TanStack React Query v5
- **Backend:** Express 5, Node.js
