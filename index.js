const KiteConnect = require("kiteconnect").KiteConnect;
const KiteTicker = require("kiteconnect").KiteTicker;
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");

// const app = express();

// app.listen(8000, () => {
//   console.log("Server started on port 8000");
// });

const apiKey = "2rtrb58mdwkhu7s7";
//const accessToken = "jx3MYBNSUhfUba1WYqMUmgkqdCBLBWPk";

const kc = new KiteConnect({
  api_key: apiKey,
});
//kc.setAccessToken(accessToken);


console.log(kc.getLoginURL());

// kc.getInstruments()
//   .then((res) => {
//     fs.writeFileSync("instruments.json", JSON.stringify(res));
//     console.log("Fetched all the instruments");
//   })
//   .catch((err) => {
//     console.error(err);
//   });

// kc.generateSession(
//   "v29FN0iIz6exjkRC5Y9CtS8ldXuNKrp6",
//   "b5gxafr7w8tsu19h6vqa53jj5usk13fq"
// )
//   .then((res) => {
//     console.log(res.access_token);
//   })
//   .catch((err) => {
//     console.error(err);
//   });

// var ticker = new KiteTicker({
//   api_key: apiKey,
//   access_token: accessToken,
// });

// ticker.connect();
// ticker.on("ticks", onTicks);
// ticker.on("connect", subscribe);

// function onTicks(ticks) {
//   console.log("Ticks", ticks);
// }

// function subscribe() {
//   var items = [138983428];
//   ticker.subscribe(items);
//   ticker.setMode(ticker.modeQuote, items);
// }
