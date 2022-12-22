const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SEC);

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tl2ww1y.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



// middleware function for jwt verify 
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.TOKEN_SECRET, function (error, decoded) {
        if (error) {
            return res.status(403).send({ message: 'Forbidden' });
        }
        req.decoded = decoded;
        next();
    })
}


const run = async () => {
    try {
        // creating Books category Collection 
        const categoriesCollection = client.db('lastBooks').collection('categories');
        const productsCollection = client.db('lastBooks').collection('products');
        const bookingsCollection = client.db('lastBooks').collection('bookings');
        const usersCollection = client.db('lastBooks').collection('users');
        const reviewsCollection = client.db('lastBooks').collection('reviews');
        const paymentsCollection = client.db('lastBooks').collection('payments');


        // Verify Admin Middleware 
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            // console.log(decodedEmail);
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden Access' });
            };

            next();
        };



        // Payment Method 
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.oldPrice;
            console.log(typeof price, price);
            if (price) {
                const amount = price * 100;
                console.log('Stripe==', stripe);
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'bdt',
                    "payment_method_types": [
                        "card"
                    ],
                })
                console.log('paymentIntent ==', paymentIntent.client_secret);
                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            }
        })

        // Inserting payment data in DB 
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    trxId: payment.trxId
                }
            }
            const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })




        // Verify Seller Middleware 
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            // console.log(decodedEmail);
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'Forbidden Access' });
            };

            next();
        };

        // Finding Admin 
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })


        // Finding Sellers 
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        })


        // Finding Verified 
        app.get('/users/verify/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ isVerified: user?.verify === true });
        })

        // getting data from categories categoriesCollection
        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoriesCollection.find(query).toArray();
            res.send(categories);
        })

        // Loading Products from productsCollection
        app.get('/products/:titleName', async (req, res) => {
            const title = req.params.titleName;
            // console.log(title);
            const filter = { titleName: title };
            const products = await productsCollection.find(filter).toArray();
            res.send(products);
        })

        // Adding new products 
        app.post('/products', async (req, res) => {
            const product = req.body;
            // console.log(product);
            const result = await productsCollection.insertOne(product);
            res.send(result);
        })

        app.get('/myProducts', async (req, res) => {
            const email = req.query.email;
            // console.log(email);
            const filter = { email: email };
            const products = await productsCollection.find(filter).toArray();
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
            // const decodedEmail = req.decoded.email;
            // if (email !== decodedEmail) {
            //     return res.status(403).status({ message: 'Forbidden Access' });
            // };
            const query = { email: email };
            const orders = await bookingsCollection.find(query).toArray();
            res.send(orders);
        });

        // Reporting orders 
        app.put('/bookings/reported/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    reported: true
                }
            };
            const result = await bookingsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        // Deleting order 
        app.delete('/bookings/reported/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await bookingsCollection.deleteOne(filter);
            res.send(result);
        })

        // Getting All Reported items 
        app.get('/bookings/reported', async (req, res) => {
            const filter = { reported: true };
            const results = await bookingsCollection.find(filter).toArray();
            res.send(results);
        })

        // Getting All Reported items 
        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const results = await bookingsCollection.findOne(filter);
            res.send(results);
        })

        // Get jwt token 
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            if (user && user.email) {
                const token = jwt.sign({ email }, process.env.TOKEN_SECRET, { expiresIn: '7d' });
                return res.send({ accessToken: token })
            }
            // console.log(user);
            res.status(403).send({ accessToken: '' });
        })

        // Creating user in dB 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // Getting Sellers for admin 
        app.get('/users/sellers', async (req, res) => {
            const query = { role: 'seller' };
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        })

        // Getting Buyers for admin 
        app.get('/users/buyers', async (req, res) => {
            const query = { role: 'buyer' };
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        })

        // Blue tick handling
        app.put('/users/sellers/verified/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    verify: true
                }
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        // Deleting Sellers 
        app.delete('/users/sellers/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })

        // Deleting Buyers 
        app.delete('/users/buyers/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })


        // Storing reviews 
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            console.log(review);
            const result = await reviewsCollection.insertOne(review);
            res.send(result);
        })

        // Getting reviews 
        app.get('/reviews', async (req, res) => {
            const query = {};
            const reviews = await reviewsCollection.find(query).toArray();
            res.send(reviews);
        })

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