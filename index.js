const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// middleware 
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send("'Krafti' App is running");
});

app.listen(port, () => {
    console.log(`'Krafti' App is listening & running on port ${port}`);
});