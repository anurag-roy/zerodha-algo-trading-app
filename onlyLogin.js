const KiteConnect = require("kiteconnect").KiteConnect;
const express = require("express");
// const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(express.json());

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
let accessToken;

const kc = new KiteConnect({
  api_key: apiKey,
});

console.log(`Please click on this URL to get logged in: ${kc.getLoginURL()}`);

app.use("/login", (req, res) => {
  const requestToken = req.query.request_token;
  console.log("Generating session. Please wait.");
  kc.generateSession(requestToken, apiSecret)
    .then((result) => {
      console.log("Obtained the access token.");
      accessToken = result.access_token;
    })
    .then(() => {
      kc.setAccessToken(accessToken);
      console.log("Access Token set. ", accessToken);
    })
    .then(() => {
      res.send("Login flow successful!");
    })
    .catch((error) => {
      console.log("Error during login flow: ", error);
    });
});
