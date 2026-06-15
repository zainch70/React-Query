// ************************ React Query *********************** 
import { useState, useEffect } from 'react'
import { useQuery,keepPreviousData,useMutation,useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

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
  const { data, isLoading, isError, isFetching,isStale } = useQuery({
    queryKey: ['products', debouncedSearch],
    // queryKey: ['products', search], //when search changes, React Query treats it as a new query and refetches.No useEffect or AbortController — React Query cancels the old request when the key changes.
    queryFn: () => axios.get(`/api/products?search=${debouncedSearch}`).then((res) => res.data),
    // queryFn: () => axios.get(`/api/products?search=${search}`).then((res) => res.data),
    enabled:debouncedSearch.length === 0 || debouncedSearch.length > 2, //only fetch data when search is more than 2 characters
    placeholderData: keepPreviousData, //keep the previous data when the new data is loading
  })

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [image, setImage] = useState('')

  const queryClient = useQueryClient()

  const addProductMutation = useMutation({
    mutationFn: (newProduct) =>
      axios.post('/api/products', newProduct).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] }) //invalidate the query to get the latest data
      setName('')
      setPrice('')
      setImage('')
    }
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

        {addProductMutation.isError && <p>Failed to add product</p>}
        {addProductMutation.isSuccess && <p>Product added successfully!</p>}
       </form>
  
      <input type="text" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />

      {search !== debouncedSearch && <p>Waiting for you to stop typing...</p>}

      {isSearchTooShort && <p>Type at least 3 characters to search</p>}

      {/* show the previous data when the new data is loading */}
      {isFetching && <p>fetching from api...</p>}

      {/* show the fresh data when the new data is loading */}
      {!isFetching && !isStale && <p>Served from cache (fresh)</p>}

      {!isSearchTooShort && (
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
      )}
    </>
  )
}

export default App

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
