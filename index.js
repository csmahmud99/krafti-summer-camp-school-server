const express = require("express");
const app = express();
const cors = require("cors");
// JWT backend-integration
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

// middleware 
app.use(cors());
app.use(express.json());

// JWT Middleware
const verifyJWT = (req, res, next) => {
    // Receiving of authorization-token from the user to check if the authorization-header is there or not
    const authorization = req.headers.authorization;
    // No authorization-header, means no token, means non-valid user
    if (!authorization) {
        return res.status(401).send({ error: true, message: "Unauthorized access" });
    }
    // Inside the authorization-header, something exists, it can be valid-token or not, have the both possibilities
    // Trying to find the token from the authorization-header || bearer token; split it, will give 2 Arrays, token-part index number will be '1'.
    const token = authorization.split(" ")[1];
    // Verifying of the JWT token
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "Unauthorized access" });
        }
        // If no-error is happened & the token is OK, then...
        req.decoded = decoded;
        next();
    });
};

// *********************MongoDB Connection code starts from here*********************

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clusterkraftischool.5rzdjri.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        // Creating a collection in the database for storing signed-up user's information
        const usersCollection = client.db("kraftiDb").collection("users");
        const classesCollection = client.db("kraftiDb").collection("classes");
        const cartsCollection = client.db("kraftiDb").collection("carts");
        const paymentsCollection = client.db("kraftiDb").collection("payments");


        // ********** JWT related APIs **********
        // API for JWT Access-token generation request on the client-side
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });


        // 'verifyAdmin' middleware || Need MongoDB connection, so written inside it.
        // WARNING: use 'verifyJWT' before using 'verifyAdmin'
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "admin") {
                return res.status(403).send({ error: true, message: "forbidden access" });
            }
            next();
        };


        // 'verifyInstructor' middleware || Need MongoDB connection, so written inside it.
        // WARNING: use 'verifyJWT' before using 'verifyInstructor'
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "instructor") {
                return res.status(403).send({ error: true, message: "forbidden access" });
            }
            next();
        };


        // ********** Users related APIs **********
        // API of getting all users data in the client-side
        app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });


        // API for getting instructors info.s for the all-instructors page in the UI/Client-side
        app.get("/instructors", async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        // API of Sending users to DB
        app.post("/users", async (req, res) => {
            const user = req.body;
            // console.log("Req for Adding User to DB:", user);

            // Checking the user is already in the database collection or, not || Specially, needed for the 'Social Log In System'.
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            // console.log("Existing User:", existingUser);

            if (existingUser) {
                return res.send({ message: "User already exists." })
            }
            else {
                const result = await usersCollection.insertOne(user);
                res.send(result);
            };
        });


        // Basic/Primary Checking: API for checking if the user is admin or not
        // 1st-level admin checking: User is valid/not, check by 'verifyJWT'.
        app.get("/users/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;

            // 2nd-level admin checking: email inside token(decoded) and requested URL is same or not.
            if (req.decoded.email !== email) {
                res.send({ admin: false });
            }

            // N.B: 3rd-level admin checking: check admin by using a Custom-hook in the client-side. [see the hook: useAdmin.jsx]

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === "admin" };
            res.send(result);
        });


        // Basic/Primary Checking: API for checking if the user is instructor or not
        // 1st-level instructor checking: User is valid/not, check by 'verifyJWT'.
        app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;

            // 2nd-level instructor checking: email inside token(decoded) and requested URL is same or not.
            if (req.decoded.email !== email) {
                res.send({ instructor: false });
            }

            // N.B: 3rd-level instructor checking: check instructor by using a Custom-hook in the client-side. [see the hook: useInstructor.jsx]

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === "instructor" };
            res.send(result);
        });



        // API for updating a user's role info. as admin
        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "admin"
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // API for updating a user's role info. as instructor
        app.patch("/users/instructor/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "instructor"
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // ********** Classes related APIs **********
        // API for getting all classes to the UI/Client-side
        app.get("/classes", async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        });


        // Email-specific data-query API for getting instructor's created class on the UI/client-side
        app.get("/myClasses/:email", async (req, res) => {
            const email = req.params.email;
            console.log(email);
            const result = await classesCollection.find({ instructorEmail: req.params.email }).toArray();
            res.send(result);
        });


        // API for getting single-class data to update it on the basis of the 'defaultValue' inside the form-data [Get API]
        app.get('/myClass/:id', async (req, res) => {
            const id = req.params.id;
            const query = ({ _id: new ObjectId(id) })
            const result = await classesCollection.findOne(query);
            res.send(result);
        });


        // API for adding class to the MongDB server
        app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {
            const newClass = req.body;
            const result = await classesCollection.insertOne(newClass);
            res.send(result);
        });


        // API for Approving a class by state changing to 'Approved' by the Admin on UI/Client-side.
        app.patch('/classes/approved/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: "Approved"
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // API for Denying a class by state changing to 'Denied' by the Admin on UI/Client-side.
        app.patch('/classes/denied/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: "Denied"
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // API for fetching by the instructor to update class data
        app.put("/classes/:id", async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    nameClass: body.nameClass,
                    image: body.image,
                    seats: body.seats,
                    price: body.price,
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // ********** Selected Classes related APIs **********
        // API for student email-specific selected class data
        app.get('/selectClass', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            const query = { email: email };
            const result = await cartsCollection.find(query).toArray();
            res.send(result);
        });


        // API for student selected classes post data
        app.post('/selectClass', async (req, res) => {
            const selectClass = req.body;
            const result = await cartsCollection.insertOne(selectClass);
            res.send(result);
        });


        // ********** Payment related APIs **********
        // API of Create payment Intent
        app.post('/createPaymentIntent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            });
        });


        // Payment API Main
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const id = payment.payId;
            const classId = payment.classId;
            const seats = payment.seats - 1;
            const enroll = payment.enroll + 1;
            const insertResult = await paymentsCollection.insertOne(payment);
            const query = { _id: new ObjectId(id) };
            const deleteResult = await cartsCollection.deleteOne(query);
            const filter = { _id: new ObjectId(classId) };
            const updateDoc = {
                $set: {
                    seats: seats,
                    enroll: enroll,
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);

            res.send({ insertResult, deleteResult, result });
        });


        // ********** Enrolled Classes related APIs **********
        //server get the call user email base data provide to user enroll classes
        app.get('/enrolledStudent/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const enrolledClass = await paymentsCollection.find({ email: req.params.email}).toArray();
            res.send(enrolledClass);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

// *********************MongoDB Connection code ends here*********************

app.get('/', (req, res) => {
    res.send("'Krafti' App is running");
});

app.listen(port, () => {
    console.log(`'Krafti' App is listening & running on port ${port}`);
});