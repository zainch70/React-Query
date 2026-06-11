# React Query — Learning Project

A full-stack practice app for learning **TanStack React Query** (`@tanstack/react-query`).  
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

## What We Built Today

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

---

## React Query — Steps We Completed

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
| Option | Purpose |
|--------|---------|
| `staleTime` | How long data is "fresh" — no refetch while fresh |
| `gcTime` | How long unused cache stays in memory |

```jsx
staleTime: 1000 * 60 * 5,  // 5 minutes
gcTime: 1000 * 60 * 10,    // 10 minutes
```

**Test:** Search `jacket` → search `mens` → search `jacket` again → instant result, no API call (within staleTime).

**Note:** `1000` = milliseconds. Use `1000 * 60 * 5`, not `10000 * 60 * 5`.

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

---

## Important Concepts Learned

### `queryKey` vs `queryFn`
- **`queryKey`** — *which* cache slot (label / path)
- **`queryFn`** — *how* to fetch data for that slot

### React Query cache vs HTTP `304`
| | React Query cache | HTTP 304 |
|---|-------------------|----------|
| Where | In-memory (client) | Browser / server |
| Network request | **None** when cache hit | Request still sent |
| When it helps | Revisit same search term | Server says "not modified" |

### What React Query replaced
| Manual (`useEffect`) | React Query |
|----------------------|-------------|
| `useState` for data/loading/error | `data`, `isLoading`, `isError` |
| `useEffect` for fetching | `useQuery` |
| `AbortController` cleanup | Built-in cancellation |
| No cache | Automatic per-`queryKey` cache |

---

## What's Next (optional)
- [ ] React Query DevTools
- [ ] `useMutation` (POST / PUT / DELETE)
- [ ] `invalidateQueries` after mutations
- [ ] Re-apply product store CSS styling

---

## Tech Stack
- **Frontend:** React 19, Vite, Axios, TanStack React Query v5
- **Backend:** Express 5, Node.js
