import express from "express";
const app = express();
app.use(express.json()); //middleware to parse json body

// http://localhost:3000/api/products?search=mens
let products = [
    {
        id: 1,
        name: "Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops",
        price: 109.95,
        image: "https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_t.png"
    },
    {
        id: 2,
        name: "Mens Casual Premium Slim Fit T-Shirts",
        price: 22.3,
        image: "https://fakestoreapi.com/img/71-3HjGNDUL._AC_SY879._SX._UX._SY._UY_t.png"
    },
    {
        id: 3,
        name: "Mens Cotton Jacket",
        price: 55.99,
        image: "https://fakestoreapi.com/img/71li-ujtlUL._AC_UX679_t.png"
    },
    {
        id: 4,
        name: "Mens Casual Slim Fit",
        price: 15.99,
        image: "https://fakestoreapi.com/img/71YXzeOuslL._AC_UY879_t.png"
    },
];

// Parallel queries — fetch stats while loading products
app.get("/api/products/stats", (req, res) => {
    const total = products.length
    const averagePrice =
      total === 0
        ? 0
        : products.reduce((sum, p) => sum + p.price, 0) / total
  
    setTimeout(() => {
      res.json({ total, averagePrice: Number(averagePrice.toFixed(2)) })
    }, 1500) // slow on purpose so you see parallel loading
  })
  
app.get("/api/products", (req, res) => {
    if(req.query.search) {
        const search = req.query.search;
        const filteredProducts = products.filter(product => product.name.toLowerCase().includes(search.toLowerCase()));
        res.send(filteredProducts);
        return; //return needed otherwise app crashes
    }
   
    // setTimeout(() => {
    //     res.send(products);
    // }, 3000);

    //pagination 
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 2
    const start = (page - 1) * limit
    const pageProducts = products.slice(start, start + limit)
    const nextPage = start + limit < products.length ? page + 1 : undefined

    setTimeout(() => {
        res.json({ products: pageProducts, nextPage, total: products.length })
    }, page === 1 ? 3000 : 1000)
});

const PORT = 3000;
app.post("/api/products", (req, res) => {
    const { name, price, image } = req.body;

    if (!name || price == null || !image) {
        return res.status(400).json({ //Rejects bad input before “creating” anything
            error: "name, price, and image are required",
        });
    }

    const newProduct = {
        id: Date.now(),
        name,
        price: Number(price),
        image,
    };

    // products.push(newProduct);
    products.unshift(newProduct)  // new product appears on page 1
    // For learning: we don't persist to a DB — just echo back the created product
    res.status(201).json(newProduct);
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});