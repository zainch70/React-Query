import { useState, useEffect } from 'react'
import axios from 'axios'

//all best cases to handle api calls are below
function App() {
  // const { products, error, loading } = customerReactHook('api/products');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
 
  useEffect(() => {
    // controller is a safety mechanism — it cancels outdated or unnecessary requests so you don’t show wrong data or update state after the component is gone
    const controller = new AbortController();

     //this is ifi function that will run when the component mounts beacuse we cannot use async with hooks ; use for safety purpose so compiler differs the ifi from other code
    ;(async () => {
      try {
        setLoading(true);
        setError(false);
        const response = await axios.get(`api/products?search=${search}`, { signal: controller.signal });//basiclaly we are senidning controller signal here ,these are extra config otpions provide by axios and signal is used to abort the request i
        console.log(response.data);
        setProducts(response.data);
        setLoading(false);
      } catch (error) {
        //handel the cancel requst in catch it is by deafult beahaviour
        if(axios.isCancel(error)) {
          console.log('Request cancelled');
          return;
        }
        console.error('Error fetching products:', error);
        setError(true);
        setLoading(false);
      }
    })();

    //cleanup method it runs when complete mount and use when unmounitng happens after runing all useffect code
    return () => {
      controller.abort();
    }
  }, [search]);


  // if there is no if handling we use conditional rendering
  if(error) {
    return <h1>Error fetching products</h1>
  }

  if(loading) {
    return <h1>Loading...</h1>
  }

  return (
  <>
  <h1>Hello World</h1>
  <input type="text" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
  <h2>number of products: {products.length}</h2>
  {products.map((product) => (
    <div key={product.id}>
      <h3>{product.name}</h3>
      <p>{product.price}</p>
      <img src={product.image} alt={product.name} />
    </div>
  ))}
  </>
  )
}

export default App

// const customerReactHook = (url) => {
  
//   return { products, error, loading };
// }
