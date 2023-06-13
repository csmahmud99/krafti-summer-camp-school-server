const express = require("express");
const app = express();
const cors = require("cors");
// JWT backend-integration
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

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

        
        // ********** JWT related APIs **********
        // API for JWT Access-token generation request on the client-side
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });


        // ********** Users related APIs **********
        // API of getting all users data in the client-side
        app.get("/users", verifyJWT, async (req, res) => {
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