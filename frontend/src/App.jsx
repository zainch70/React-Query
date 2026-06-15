// ************************ React Query *********************** 
import { useState, useEffect } from 'react'
import { useQuery,useInfiniteQuery,keepPreviousData,useMutation,useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const PAGE_LIMIT = 2 // must match backend limit=2
const productsInfiniteOptions = {
  queryKey: ['products', 'infinite'],
  queryFn: ({ pageParam }) =>
    axios.get(`/api/products?page=${pageParam}&limit=${PAGE_LIMIT}`).then((res) => res.data),
  initialPageParam: 1,
  getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
}

function App() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timeoutId  = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)
    return () => clearTimeout(timeoutId )
  }, [search])

  //isloading true when First fetch, no data to show yet
  //isfetching true when Any request running (first load or refetch)
  // const { data, isLoading, isError, isFetching,isStale } = useQuery({
  //   queryKey: ['products', debouncedSearch],
  //   // queryKey: ['products', search], //when search changes, React Query treats it as a new query and refetches.No useEffect or AbortController — React Query cancels the old request when the key changes.
  //   queryFn: () => axios.get(`/api/products?search=${debouncedSearch}`).then((res) => res.data),
  //   // queryFn: () => axios.get(`/api/products?search=${search}`).then((res) => res.data),
  //   enabled:debouncedSearch.length === 0 || debouncedSearch.length > 2, //only fetch data when search is more than 2 characters
  //   placeholderData: keepPreviousData, //keep the previous data when the new data is loading
  // })

  const isSearching = debouncedSearch.length > 2

  // Infinite scroll — full list only (no search)
  const {
    data: infiniteData,
    isLoading: isInfiniteLoading,
    isError: isInfiniteError,
    isFetching: isInfiniteFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
   ...productsInfiniteOptions,
    enabled: debouncedSearch === '',
  })

  // Search — same as before
  const {
    data: searchData,
    isLoading: isSearchLoading,
    isError: isSearchError,
    isFetching: isSearchFetching,
    isStale: isSearchStale,
  } = useQuery({
    queryKey: ['products', debouncedSearch],
    queryFn: () =>
      axios.get(`/api/products?search=${debouncedSearch}`).then((res) => res.data),
    enabled: isSearching,
    placeholderData: keepPreviousData,
  })

   //flatten the array of arrays into a single array
  const products = isSearching
  ? searchData ?? []
  : infiniteData?.pages.flatMap((page) => page.products) ?? []
  //total number of products on the server
  const totalOnServer = infiniteData?.pages?.[0]?.total
  const loadedCount = products.length

  const isLoading = isSearching ? isSearchLoading : isInfiniteLoading
  const isError = isSearching ? isSearchError : isInfiniteError
  const isFetching = isSearching ? isSearchFetching : isInfiniteFetching
  const isStale = isSearching ? isSearchStale : false

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [image, setImage] = useState('')

  const queryClient = useQueryClient()
  const prefetchNextPage = () => {
    if (!hasNextPage || isFetchingNextPage || isSearching) return

    const nextPage = infiniteData?.pages?.at(-1)?.nextPage
    if (!nextPage) return

    const prefetchKey = ['products', 'page', nextPage]//This loads page 2 into ['products', 'page', 2] — not into the infinite list the UI reads.

    // already prefetched — don't fetch again
    if (queryClient.getQueryData(prefetchKey)) return

    queryClient.prefetchQuery({
      queryKey: prefetchKey,
      queryFn: () =>
        axios
          .get(`/api/products?page=${nextPage}&limit=${PAGE_LIMIT}`)
          .then((res) => res.data),
      staleTime: 0,
    })
  }

  const handleLoadMore = () => {
    const nextPage = infiniteData?.pages?.at(-1)?.nextPage
    if (!nextPage) return

    const prefetchKey = ['products', 'page', nextPage]
    const prefetchedPage = queryClient.getQueryData(prefetchKey)

    // prefetched on hover → merge instantly, no network wait
    if (prefetchedPage) {
      queryClient.setQueryData(['products', 'infinite'], (old) => {
        if (!old) return old
        return {
          pages: [...old.pages, prefetchedPage],
          pageParams: [...old.pageParams, nextPage],
        }
      })
      queryClient.removeQueries({ queryKey: prefetchKey })
      return
    }

    // no prefetch → normal fetch
    fetchNextPage()
  }

  // const addProductMutation = useMutation({
  //   mutationFn: (newProduct) =>
  //     axios.post('/api/products', newProduct).then((res) => res.data),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ['products'] }) //invalidate the query to get the latest data
  //     setName('')
  //     setPrice('')
  //     setImage('')
  //   }
  // })

  //optimistic update is a technique to update the UI immediately before the server responds. so it cause immediate ui updates to avoid network round trip latency and fetches in background.
  const addProductMutation = useMutation({
    mutationFn: (newProduct) =>
      axios.post('/api/products', newProduct).then((res) => res.data),
//this is before infinite scroll optimistic update
    // onMutate: async (newProduct) => {
    //   // 1. Cancel in-flight refetches so they don't overwrite our optimistic update
    //   await queryClient.cancelQueries({ queryKey: ['products', debouncedSearch] })

    //   // 2. Save snapshot for rollback
    //   const previousProducts = queryClient.getQueryData(['products', debouncedSearch])

    //   // 3. Instantly add fake product to cache
    //   queryClient.setQueryData(['products', debouncedSearch], (old) => [
    //     ...(old ?? []),
    //     {
    //       id: Date.now(), // temporary id until server responds
    //       name: newProduct.name,
    //       price: newProduct.price,
    //       image: newProduct.image,
    //     },
    //   ])

    //   // 4. Pass snapshot to onError
    //   return { previousProducts }
    // },

    //this is after infinite scroll optimistic update
    onMutate: async (newProduct) => {
      const queryKey = debouncedSearch === ''
        ? ['products', 'infinite']
        : ['products', debouncedSearch]

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData(queryKey)

      // PATH A: empty search → infinite scroll cache
      if (debouncedSearch === '') {
        const tempId = Date.now()

        queryClient.setQueryData(queryKey, (old) => {
          if (!old?.pages?.length) return old
          return {
            ...old,
            pages: old.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    products: [
                      { id: tempId, ...newProduct },
                      ...page.products,
                    ].slice(0, PAGE_LIMIT),
                  }
                : page
            ),
          }
        })

        return { previousData, queryKey, tempId }
      }

      // PATH B: active search → plain array cache (append)
      queryClient.setQueryData(queryKey, (old) => [
        ...(old ?? []),
        { id: Date.now(), ...newProduct },
      ])

      return { previousData, queryKey }
    },

    onError: (_err, _newProduct, context) => {
      queryClient.setQueryData(context.queryKey, context.previousData)
    },

    // onError: (_err, _newProduct, context) => {
    //   // Rollback on failure
    //   queryClient.setQueryData(
    //     ['products', debouncedSearch],
    //     context.previousProducts
    //   )
    // },

    // onSuccess: () => {
    //   setName('')
    //   setPrice('')
    //   setImage('')
    // },

    onSuccess: (createdProduct, _variables, context) => {
      setName('')
      setPrice('')
      setImage('')

      // Infinite list: swap temp row for real server product (no refetch = no 3→2 flash)
      if (context?.queryKey?.[1] === 'infinite') {
        queryClient.setQueryData(['products', 'infinite'], (old) => {
          if (!old?.pages?.length) return old
          return {
            ...old,
            pages: old.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    products: [
                      createdProduct,
                      ...page.products.filter((p) => p.id !== context.tempId),
                    ].slice(0, PAGE_LIMIT),
                  }
                : page
            ),
          }
        })
        return
      }

      // Search list: refetch to sync
      queryClient.invalidateQueries({ queryKey: context.queryKey })
    },

    //This was causing the count to drop after add.
    // onSettled: () => {
    //   // Always sync with server after success OR error
    //   queryClient.invalidateQueries({ queryKey: ['products'] })
    // },
  })

  const handleAddProduct = (e) => {
    e.preventDefault()
  
    addProductMutation.mutate({
      name,
      price: Number(price),
      image,
    })
  }

  if (isLoading) {
    return <h1>Loading...</h1>
  }
  
  const isSearchTooShort = debouncedSearch.length > 0 && debouncedSearch.length <= 2

  if (isError) {
    return <h1>Error fetching products</h1>
  }

  return (
    <>
      <h1>Hello World</h1>
       <form onSubmit={handleAddProduct}>
        <h2>Add Product</h2>
        <input
          type="text"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <input
          type="text"
          placeholder="Image URL"
          value={image}
          onChange={(e) => setImage(e.target.value)}
        />
        <button type="submit" disabled={addProductMutation.isPending}>
          {addProductMutation.isPending ? 'Adding...' : 'Add Product'}
        </button>

        {addProductMutation.isError && <p>Failed to add product — list rolled back to previous state</p>}
        {addProductMutation.isSuccess && (
          <p role="status">✓ Product added — it appears at the top of the list</p>
        )}
       </form>
  
      <input type="text" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />

      {search !== debouncedSearch && <p>Waiting for you to stop typing...</p>}

      {isSearchTooShort && <p>Type at least 3 characters to search</p>}

      {/* show the previous data when the new data is loading */}
      {isFetching && <p>fetching from api...</p>}

      {/* show the fresh data when the new data is loading */}
      {!isFetching && !isStale && <p>Served from cache (fresh)</p>}

    {/* it is for without pagination and search */}
      {/* {!isSearchTooShort && (
        <>
          <h2>number of products: {data?.length ?? 0}</h2>
          {data?.map((product) => (
            <div key={product.id}>
              <h3>{product.name}</h3>
              <p>{product.price}</p>
              <img src={product.image} alt={product.name} />
            </div>
          ))}
        </>
      )} */}

{/* it is for with pagination and search */}
      {!isSearchTooShort && (
        <>
            <h2>
            {isSearching
              ? `Found ${loadedCount} product${loadedCount === 1 ? '' : 's'}`
              : totalOnServer != null
                ? `Showing ${loadedCount} of ${totalOnServer} product${totalOnServer === 1 ? '' : 's'}${hasNextPage ? ' — load more below' : ''}`
                : `Showing ${loadedCount} product${loadedCount === 1 ? '' : 's'}`}
          </h2>
          {products.map((product) => (
            <div key={product.id}>
              <h3>{product.name}</h3>
              <p>{product.price}</p>
              <img src={product.image} alt={product.name} />
            </div>
          ))}

          {!isSearching && hasNextPage && (
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Tip: hover Load more to prefetch the next page
            </p>
          )}
          <br />
          {/* load more button with prefetching to avoid flickering */}
          {!isSearching && hasNextPage && (
            <button
              onMouseEnter={prefetchNextPage}
              onFocus={prefetchNextPage}
              onClick={handleLoadMore}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading more...' : 'Load more'}
            </button>
          )}
        </>
      )}
    </>
  )
}

export default App

//***********Chai with react basic understanding code*********
// import { useState, useEffect } from 'react'
// import axios from 'axios'

// //all best cases to handle api calls are below
// function App() {
//   // const { products, error, loading } = customerReactHook('api/products');
//   const [products, setProducts] = useState([]);
//   const [error, setError] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [search, setSearch] = useState('');
 
//   useEffect(() => {
//     // controller is a safety mechanism — it cancels outdated or unnecessary requests so you don’t show wrong data or update state after the component is gone
//     const controller = new AbortController();

//      //this is ifi function that will run when the component mounts beacuse we cannot use async with hooks ; use for safety purpose so compiler differs the ifi from other code
//     ;(async () => {
//       try {
//         setLoading(true);
//         setError(false);
//         const response = await axios.get(`api/products?search=${search}`, { signal: controller.signal });//basiclaly we are senidning controller signal here ,these are extra config otpions provide by axios and signal is used to abort the request i
//         console.log(response.data);
//         setProducts(response.data);
//         setLoading(false);
//       } catch (error) {
//         //handel the cancel requst in catch it is by deafult beahaviour
//         if(axios.isCancel(error)) {
//           console.log('Request cancelled');
//           return;
//         }
//         console.error('Error fetching products:', error);
//         setError(true);
//         setLoading(false);
//       }
//     })();

//     //cleanup method it runs when complete mount and use when unmounitng happens after runing all useffect code
//     return () => {
//       controller.abort();
//     }
//   }, [search]);


//   // if there is no if handling we use conditional rendering
//   if(error) {
//     return <h1>Error fetching products</h1>
//   }

//   if(loading) {
//     return <h1>Loading...</h1>
//   }

//   return (
//   <>
//   <h1>Hello World</h1>
//   <input type="text" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
//   <h2>number of products: {products.length}</h2>
//   {products.map((product) => (
//     <div key={product.id}>
//       <h3>{product.name}</h3>
//       <p>{product.price}</p>
//       <img src={product.image} alt={product.name} />
//     </div>
//   ))}
//   </>
//   )
// }

// export default App

// // const customerReactHook = (url) => {
  
// //   return { products, error, loading };
// // }
