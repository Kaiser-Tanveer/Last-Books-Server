const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, Collection, ObjectId } = require('mongodb');
const { query } = require('express');

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tl2ww1y.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const run = async () => {
    try {
        // creating Books category Collection 
        const categoriesCollection = client.db('lastBooks').collection('categories');
        const bookingsCollection = client.db('lastBooks').collection('bookings');
        const usersCollection = client.db('lastBooks').collection('users');

        // getting data from categories categoriesCollection
        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoriesCollection.find(query).toArray();
            res.send(categories);
        })

        // getting data by id 
        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) }
            const products = await categoriesCollection.findOne(filter);
            res.send(products);
        })

        // Posting orders to booking collection 
        app.post('/bookings', async (req, res) => {
            const order = req.body;
            const result = await bookingsCollection.insertOne(order);
            res.send(result);
        })

        // Getting orders data 
        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const orders = await bookingsCollection.find(query).toArray();
            res.send(orders);
        })

        // Posting users to store in BD

    }
    finally {

    }
}

run()
    .catch(err => console.log(err));



app.get('/', (req, res) => {
    res.send('Books server is running..');
});

app.listen(port, (req, res) => {
    console.log(`server is running on port ${port}`);
});