const KiteConnect = require("kiteconnect").KiteConnect;
const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const apiKey = "2rtrb58mdwkhu7s7";
const apiSecret = "b5gxafr7w8tsu19h6vqa53jj5usk13fq";
let accessToken;

const kc = new KiteConnect({
  api_key: apiKey,
});

const server = app.listen(8000, () => {
  console.log(`Please click on this URL to get logged in: ${kc.getLoginURL()}`);
});

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
      const contents = `API_KEY="${apiKey}"
      API_SECRET="${apiSecret}"
      ACCESS_TOKEN="${accessToken}"`;
      writeEnvFile(contents);
    })
    .then(() => {
      res.send("Login flow successful!");
    })
    .then(() => {
      server.close();
    })
    .catch((error) => {
      console.log("Error during login flow: ", error);
    });
});

const writeEnvFile = (contents) => {
  fs.writeFileSync(".env", contents, (err) => {
    if (err) console.log(err);
  });
};
