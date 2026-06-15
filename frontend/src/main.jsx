import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools' //for devtools

// const queryClient = new QueryClient(); if defaultoptions not used then set it in usequery in app.jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  ////React Query won't refetch for 5 minutes and treat cached data as fresh
      gcTime: 1000 * 60 * 10,    // After you leave a search, its cache stays in memory for 10 min
      refetchOnWindowFocus: true,   // refetch stale queries when user returns to tab
      refetchOnReconnect: true,     // refetch stale queries when network reconnects
      retry: 2,                     // retry failed requests 2 times (default is 3)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 30 seconds max
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
       <ReactQueryDevtools initialIsOpen={false}/> {/*initialIsOpen={false} to hide the devtools by default */}
    </QueryClientProvider>
  </StrictMode>,
)
