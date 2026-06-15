# React Query — Learning Project

A full-stack practice app for learning **TanStack React Query** (`@tanstack/react-query`) — a **server-state management** library for fetching, caching, syncing, and mutating API data in React.  
Backend serves dummy products (in-memory); frontend fetches, searches, caches, debounces, and adds products via mutations.

---

## Project Structure

```
react-query/
├── backend/          # Express API (port 3000)
│   └── index.js      # GET /api/products (pagination + search) + POST /api/products
└── frontend/         # React + Vite (port 5173)
    └── src/
        ├── main.jsx  # QueryClientProvider + defaultOptions + refetch/retry + DevTools
        ├── App.jsx   # useInfiniteQuery + prefetch + optimistic updates + search
        └── App.css   # Product store layout + cards + form + status banners
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
| **11–15 June 2026** | `useQuery`, caching, mutations, DevTools, `enabled`, `defaultOptions`, optimistic updates, `useInfiniteQuery`, `prefetchQuery`, `refetchOnWindowFocus`, `retry`, product store CSS | **~78% overall** / **~94% fundamentals** | ✅ Learned |

**Quick jump:** [Learned](#-learned) · [Not learned yet](#-not-learned-yet)

---

## ✅ Learned

> Built the app, replaced manual `useEffect` fetching with React Query, learned caching deeply, added **mutations** and **cache invalidation**, used **DevTools**, added **`enabled`** and global **`defaultOptions`**, implemented **optimistic updates**, **`useInfiniteQuery`**, **`prefetchQuery`**, tuned **`refetchOnWindowFocus`** / **`retry`** for production behavior, and polished the **product store UI** with `App.css`.

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

### Step 13 — Global `defaultOptions`

**Problem:** `staleTime` and `gcTime` were set inside `App.jsx` on every `useQuery`. That works for one query, but in a real app you'd repeat the same values in many components.

**Fix:** Set defaults once on `QueryClient` in `main.jsx` — every `useQuery` in the app inherits them.

```jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 min
      gcTime: 1000 * 60 * 10,    // 10 min
    },
  },
})
```

Then **remove** `staleTime` and `gcTime` from `App.jsx` — the products query picks up the globals automatically.

| Level | Where | Who gets it |
|-------|--------|-------------|
| **Global** | `main.jsx` → `QueryClient.defaultOptions.queries` | Every `useQuery` under `QueryClientProvider` |
| **Per query** | `useQuery({ staleTime: ... })` in any component | Only that query — **overrides** global |

**Key idea:** `QueryClient` lives at the root (`main.jsx`), not inside `App`. Any future component (`Navbar`, `Profile`, etc.) that calls `useQuery` gets the same cache timing without copy-pasting options.

```
main.jsx
  QueryClient (defaultOptions: staleTime, gcTime)
       ↓
  QueryClientProvider
       ↓
  App.jsx → useQuery({ queryKey, queryFn, enabled, ... })  // inherits globals
```

**How we tested:**
1. Removed `staleTime` / `gcTime` from `App.jsx`
2. Empty search → still loads with 3s delay
3. Search `mens` → caching still works (fresh within 5 min)
4. Add product → `invalidateQueries` still refetches the list
5. DevTools → same Fresh / Stale / Inactive behavior as before

**Production pattern:** globals for shared defaults; per-query options only when one query needs something different (e.g. `staleTime: 0` for live dashboard data).

### Step 14 — Optimistic updates (`onMutate` + `setQueryData`)

**Problem:** With `invalidateQueries` only, the user submits the form and waits for POST + refetch before the new product appears — noticeable network latency.

**Fix:** **Optimistic update** — edit the cache immediately on submit, then let POST run in the background. Roll back if it fails.

```jsx
const addProductMutation = useMutation({
  mutationFn: (newProduct) =>
    axios.post('/api/products', newProduct).then((res) => res.data),

  onMutate: async (newProduct) => {
    await queryClient.cancelQueries({ queryKey: ['products', debouncedSearch] })
    const previousProducts = queryClient.getQueryData(['products', debouncedSearch])

    queryClient.setQueryData(['products', debouncedSearch], (old) => [
      ...(old ?? []),
      { id: Date.now(), ...newProduct },
    ])

    return { previousProducts }
  },

  onError: (_err, _newProduct, context) => {
    queryClient.setQueryData(['products', debouncedSearch], context.previousProducts)
  },

  onSuccess: () => { /* clear form */ },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
  },
})
```

**Mutation lifecycle:**

| Callback | When | Job |
|----------|------|-----|
| **`onMutate`** | Before POST | Cancel refetches, snapshot cache, `setQueryData` with temp product |
| **`mutationFn`** | During | Real POST |
| **`onError`** | POST failed | Restore snapshot (rollback) |
| **`onSuccess`** | POST OK | Clear form |
| **`onSettled`** | Always | `invalidateQueries` — sync real server `id` |

```
Submit → onMutate (UI updates NOW)
      → POST (background)
      → success: onSettled → invalidate → real id from server
      → error: onError → rollback → onSettled → invalidate
```

| Approach | When UI updates |
|----------|-----------------|
| **`invalidateQueries` only** | After POST + refetch |
| **Optimistic** | Instantly on submit |

**Key APIs introduced:**
- **`setQueryData`** — manually write to cache (optimistic fake row)
- **`getQueryData`** — read current cache (for snapshot)
- **`cancelQueries`** — stop in-flight refetches from overwriting optimistic data

**How we tested:**
1. Add product on empty search → count increases **before** POST finishes
2. Success → `invalidateQueries` replaces temp `id` with server `id`
3. Force POST `400` on backend → list rolls back, error: *"Failed to add product — list rolled back to previous state"*

**Caveat:** Optimistic update targets the **active** key `['products', debouncedSearch]`. On a filtered search, a new product only appears if that cache key is active (e.g. empty search shows all products).

**vs Step 10:** We still use `invalidateQueries` for search-mode adds. For the full list (infinite query), see [Step 15](#step-15--useinfinitequery--pagination--ux-safe-optimistic-add) — we sync with `setQueryData` in `onSuccess` instead of invalidating, to avoid a confusing count flash.

### Step 15 — `useInfiniteQuery` + pagination + UX-safe optimistic add

**Problem:** Loading all products at once doesn't scale. With pagination, optimistic add + `invalidateQueries` caused a confusing UI: count jumped **3 → 2** (optimistic append on page 1, then refetch restored server's 2-item page).

**Fix:** `useInfiniteQuery` for the full list + tuned optimistic update for paginated cache.

#### Backend — paginated GET + `total`

```js
const page = Number(req.query.page) || 1
const limit = Number(req.query.limit) || 2
const start = (page - 1) * limit
const pageProducts = products.slice(start, start + limit)
const nextPage = start + limit < products.length ? page + 1 : undefined

res.json({ products: pageProducts, nextPage, total: products.length })
```

- **Search** (`?search=mens`) — still returns a plain array (unchanged)
- **POST** — `products.unshift(newProduct)` so new items appear on page 1

#### Before pagination vs after (API shape)

**Before pagination** — one request returned **all products** as a flat array:

```json
[ { "id": 1, ... }, { "id": 2, ... }, { "id": 3, ... }, { "id": 4, ... } ]
```

Frontend `useQuery` cache: `data = [ p1, p2, p3, p4 ]`

**After pagination** (`limit = 2`) — each request returns **one slice** wrapped in an object:

| Page | URL | `start` | Slice | Products (indices) |
|------|-----|---------|-------|---------------------|
| 1 | `?page=1&limit=2` | 0 | `[0:2]` | index 0, 1 |
| 2 | `?page=2&limit=2` | 2 | `[2:4]` | index 2, 3 |

Page 1 response:
```json
{ "products": [p1, p2], "nextPage": 2, "total": 4 }
```

Page 2 response:
```json
{ "products": [p3, p4], "nextPage": undefined, "total": 4 }
```

Same 4 products on the server — just fetched in **chunks** instead of all at once.

#### Frontend — two hooks (rules of hooks: always call both)

| Mode | Hook | `enabled` when |
|------|------|----------------|
| Full list | `useInfiniteQuery` | `debouncedSearch === ''` |
| Search | `useQuery` | `debouncedSearch.length > 2` |

```jsx
const PAGE_LIMIT = 2

useInfiniteQuery({
  queryKey: ['products', 'infinite'],
  queryFn: ({ pageParam }) =>
    axios.get(`/api/products?page=${pageParam}&limit=${PAGE_LIMIT}`).then((res) => res.data),
  initialPageParam: 1,
  getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  enabled: debouncedSearch === '',
})
```

**Flatten pages for UI:**

The grid needs **one flat list** — but `useInfiniteQuery` stores **many page objects**. This line picks the right source:

```jsx
const isSearching = debouncedSearch.length > 2

const products = isSearching
  ? searchData ?? []                                    // search → flat array from useQuery
  : infiniteData?.pages.flatMap((page) => page.products) ?? []  // browse → merge loaded pages
```

| Branch | When | Source | Shape |
|--------|------|--------|-------|
| `searchData` | `debouncedSearch` has 3+ chars | `useQuery` | `[ p1, p2, ... ]` |
| `flatMap` | empty or short search | `useInfiniteQuery` | merge `pages[].products` |

**How `flatMap` works** (4 products, 2 per page, both pages loaded):

```
infiniteData.pages = [
  { products: [p1, p2], nextPage: 2, total: 4 },           // page 1
  { products: [p3, p4], nextPage: undefined, total: 4 }    // page 2
]

pages.flatMap((page) => page.products)
  page 1 → [p1, p2]
  page 2 → [p3, p4]
  merged → [p1, p2, p3, p4]   ← this is what the grid maps over
```

- `?? []` — if data is still `undefined` (loading), use empty array so `.map()` doesn't crash
- `totalOnServer` comes from `pages[0].total` (server-wide count, not `products.length`)

**Load more:**
```jsx
{hasNextPage && (
  <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
    {isFetchingNextPage ? 'Loading more...' : 'Load more'}
  </button>
)}
```

#### Key `useInfiniteQuery` options

| Option | Job |
|--------|-----|
| `initialPageParam` | First page number (`1`) |
| `pageParam` in `queryFn` | Current page passed by React Query |
| `getNextPageParam` | Return `nextPage` from API, or `undefined` when done |
| `fetchNextPage()` | Fetch the next page |
| `hasNextPage` | `true` when more pages exist |

**Cache shape:** `{ pages: [{ products, nextPage, total }, ...], pageParams: [1, 2, ...] }` — not a flat array.

#### UX fix — optimistic add without count flash

**Problem users saw:** Add product → count **3** → then **2** (felt like product was removed).

**Why:** Optimistic **append** added a 3rd row on page 1; `invalidateQueries` refetched page 1 with `limit=2` from server.

**Fix (3 parts):**

1. **Optimistic prepend** on page 1, keep page size: `[newProduct, ...page.products].slice(0, PAGE_LIMIT)` — count stays **2**
2. **`onSuccess`** — swap `tempId` for real `createdProduct` via `setQueryData` (no `invalidateQueries` for infinite)
3. **Remove `onSettled` invalidate** for infinite path — it caused the refetch flash
4. **Bump `total` in `onMutate`** — optimistic update patches `products` but not `total` by default; without `total: (page.total ?? 0) + 1`, UI showed `Showing 2 of 4` instead of `Showing 2 of 5` until manual refresh

```jsx
onMutate: async (newProduct) => {
  if (debouncedSearch === '') {
    const tempId = Date.now()
    // prepend to page 1, slice to PAGE_LIMIT, increment total
    queryClient.setQueryData(queryKey, (old) => ({
      ...old,
      pages: old.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              total: (page.total ?? 0) + 1,
              products: [{ id: tempId, ...newProduct }, ...page.products].slice(0, PAGE_LIMIT),
            }
          : page
      ),
    }))
    return { previousData, queryKey, tempId }
  }
  // search path: append to array cache
  return { previousData, queryKey }
},

onSuccess: (createdProduct, _variables, context) => {
  if (context?.queryKey?.[1] === 'infinite') {
    // setQueryData: replace tempId with createdProduct on page 1
    return  // no invalidate
  }
  queryClient.invalidateQueries({ queryKey: context.queryKey })
},
```

**UI copy:** `Showing 2 of 5 products — load more below` (uses `total` from API) instead of a bare count that jumps.

**How we tested:**
1. Empty search → 2 products load → **Load more** → 2 more
2. Add product → count stays **2**, new product on **top** (no 3→2 flash)
3. Add product → `Showing 2 of 5` updates immediately (total bumped in cache)
4. Search `mens` → normal `useQuery` list, no Load more
5. Force POST `400` → rollback still works

**Mental model:**
```
useQuery       → one chunk:  data = Product[]
useInfiniteQuery → many chunks: data.pages = [{ products }, { products }, ...]
                                  flatMap → single list for UI
```

### Step 16 — `prefetchQuery` (background preload on hover)

**Problem:** Users wait ~1s when clicking **Load more**. We want to fetch the next page **early** (on hover) but **not** show it until they click.

**First attempt — `prefetchInfiniteQuery`:** Updates the same `['products', 'infinite']` cache → UI grows on hover automatically ❌

**Also blocked by global `staleTime` (5 min):** Prefetch skips fetch when page 1 is still "fresh" unless you pass `staleTime: 0`.

**Fix — separate staging cache + merge on click:**

| Cache key | Purpose |
|-----------|---------|
| `['products', 'infinite']` | What `useInfiniteQuery` renders |
| `['products', 'page', 2]` | Hidden prefetch slot for page 2 |

**Shared config** (must match `useInfiniteQuery`):

```jsx
const productsInfiniteOptions = {
  queryKey: ['products', 'infinite'],
  queryFn: ({ pageParam }) =>
    axios.get(`/api/products?page=${pageParam}&limit=${PAGE_LIMIT}`).then((res) => res.data),
  initialPageParam: 1,
  getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
}
```

**On hover — `prefetchQuery` into staging key:**

```jsx
const prefetchNextPage = () => {
  const nextPage = infiniteData?.pages?.at(-1)?.nextPage
  if (!nextPage) return

  const prefetchKey = ['products', 'page', nextPage]
  if (queryClient.getQueryData(prefetchKey)) return

  queryClient.prefetchQuery({
    queryKey: prefetchKey,
    queryFn: () =>
      axios.get(`/api/products?page=${nextPage}&limit=${PAGE_LIMIT}`).then((res) => res.data),
    staleTime: 0, // bypass global 5min staleTime for prefetch
  })
}
```

**On click — merge prefetched page or fall back to `fetchNextPage`:**

```jsx
const handleLoadMore = () => {
  const nextPage = infiniteData?.pages?.at(-1)?.nextPage
  const prefetchedPage = queryClient.getQueryData(['products', 'page', nextPage])

  if (prefetchedPage) {
    queryClient.setQueryData(['products', 'infinite'], (old) => ({
      pages: [...old.pages, prefetchedPage],
      pageParams: [...old.pageParams, nextPage],
    }))
    queryClient.removeQueries({ queryKey: ['products', 'page', nextPage] })
    return
  }

  fetchNextPage()
}
```

**Flow:**
```
Hover  → prefetchQuery(['products', 'page', 2]) → network in background, UI unchanged
Click  → merge into infinite cache → instant reveal
Click (no hover) → fetchNextPage() → normal ~1s wait
```

**Button wiring:**
```jsx
<button
  onMouseEnter={prefetchNextPage}
  onFocus={prefetchNextPage}
  onClick={handleLoadMore}
>
  Load more
</button>
```

**How we tested:**
1. Hover Load more → Network shows `page=2`, list still **2 products**
2. Click after hover → **4 products instantly** (no wait)
3. Click without hover → normal delay
4. DevTools → staging key `['products', 'page', 2]` appears on hover, removed after merge

**Key lessons:**
- `prefetchQuery` / `prefetchInfiniteQuery` warm cache **before** user action
- Prefetching the **same** infinite key updates the UI immediately — use a **separate key** when you want invisible preload
- Global `staleTime` applies to prefetch unless overridden with `staleTime: 0`

### Step 17 — `refetchOnWindowFocus` + `retry` (production tuning)

**Problem:** By default React Query refetches on tab focus and retries failures — but with a long `staleTime`, focus refetch often **does nothing** (data still fresh). We made behavior **explicit** and learned per-query overrides.

**Global defaults in `main.jsx`:**

```jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: true,   // refetch stale queries when user returns to tab
      refetchOnReconnect: true,     // refetch stale queries when network reconnects
      retry: 2,                     // retry failed requests 2 times (default is 3)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
})
```

| Option | Default | What it does |
|--------|---------|--------------|
| **`refetchOnWindowFocus`** | `true` | User returns to tab → refetch **if stale** |
| **`refetchOnReconnect`** | `true` | Network back online → refetch **if stale** |
| **`retry`** | `3` (we use `2`) | Retry failed requests N times |
| **`retryDelay`** | exponential | Wait between retries (1s, 2s, … cap 30s) |

**Critical interaction with `staleTime`:**

```
Tab switch + data FRESH (within 5 min)  →  NO refetch (even if refetchOnWindowFocus: true)
Tab switch + data STALE (after 5 min)   →  refetch in background
```

**Per-query override** — infinite list opts out of focus refetch:

```jsx
useInfiniteQuery({
  ...productsInfiniteOptions,
  enabled: debouncedSearch === '',
  refetchOnWindowFocus: false,  // override global true
})
```

| Mode | Focus refetch? |
|------|----------------|
| Empty search (infinite) | **No** — per-query `false` |
| Search (`useQuery`) | **Yes, if stale** — uses global `true` + 5 min `staleTime` |

**How we tested:**
1. Search `mens` → switch tab → back within 5 min → **no** refetch (still fresh)
2. DevTools → Invalidate search query → switch tab → back → refetch runs
3. Empty search → switch tab → back → **no** refetch (infinite override)
4. Stop backend → reload → `retry: 2` shows multiple attempts in Network tab

**Mental model:**
```
refetchOnWindowFocus is NOT "always refetch on tab switch"
It is "refetch on tab switch IF data is stale"
staleTime controls WHEN data becomes stale
```

### Step 18 — Product store UI polish (`App.css`)

**Goal:** Keep all React Query logic unchanged; improve layout and feedback with a dedicated stylesheet.

**Setup:**
```jsx
import './App.css'
```

**What we styled (incremental parts):**

| Part | Classes | Purpose |
|------|---------|---------|
| B/C | `.app`, `.header` | Centered layout + page title |
| D | `.search-bar` | Full-width search with focus ring |
| E | `.status`, `.status--loading`, `.status--error` | Debounce / fetch / short-search messages |
| F | `.product-count`, `.product-grid`, `.product-card` | Count line + responsive card grid |
| G | `.load-more-btn` | Primary button for pagination |
| H/I | `.add-product-form`, `.form-message--error`, `.form-message--success` | Add product card + mutation feedback |
| J | `.app` + `.status` on early returns | Full-page loading / error screens |

**Pattern:** Old plain JSX was **commented**, not deleted — so you can compare before/after in `App.jsx`.

**Loading / error screens (Part J):**
```jsx
if (isLoading) {
  return (
    <div className="app">
      <p className="status status--loading">Loading products...</p>
    </div>
  )
}

if (isError) {
  return (
    <div className="app">
      <p className="status status--error">Error fetching products</p>
    </div>
  )
}
```

**Key idea:** CSS only affects presentation — `useQuery`, `useInfiniteQuery`, prefetch, and mutations behave exactly as before.

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
Fundamentals (useQuery, cache, keys)       ██████████████████░░  ~90%
Practical patterns (debounce, search)      █████████████████░░░  ~85%
Theory (server state, staleTime, gcTime)   ████████████████████  ~95%
Mutations & sync (useMutation, invalidate, optimistic) █████████████████░░░  ~80%
DevTools & cache states (fresh/stale/…)    ██████████████░░░░░░  ~70%
Query tuning (enabled, defaults, refetch, retry)  █████████████████░░░  ~85%
Advanced (infinite, prefetch)              ████████████████░░░░  ~50%
UI polish (App.css product store)          ████████████████████  ~100%
```

**Solid foundation for reading, writing, and debugging server data.** Optional next: parallel queries, Suspense, or testing (see [Not learned yet](#-not-learned-yet)).

---

## 📋 Not learned yet

> Pick up here when you're ready. Fundamentals through **product store CSS** are in [Learned](#-learned).

### Suggested learning order

1. Parallel queries / dependent queries
2. Suspense mode with React Query
3. Testing queries with mock server

### Targets (when you learn this)

| Area | Now | Target |
|------|-----|--------|
| Overall React Query | ~78% | ~85% |
| Core fundamentals | ~94% | ~95% |
| Mutations & sync | ~80% | ~85% |
| Advanced (suspense, testing) | ~50% | ~65% |

---

## References

- [React Query Overview (ChatGPT)](https://chatgpt.com/share/6a2aa4ab-7990-83a8-8605-6fa0f2f7e7d2) — basic concepts in React Query (companion notes for this project)

---

## Tech Stack
- **Frontend:** React 19, Vite, Axios, TanStack React Query v5, React Query DevTools
- **Backend:** Express 5, Node.js
