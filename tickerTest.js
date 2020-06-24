require("dotenv").config();
const KiteTicker = require("kiteconnect").KiteTicker;

const ticker = new KiteTicker({
  api_key: process.env.API_KEY,
  access_token: process.env.ACCESS_TOKEN,
});

ticker.connect();
ticker.on("ticks", onTicks);
ticker.on("connect", subscribe);

function onTicks(ticks) {
  console.log("Ticks", ticks[0].depth);
}

function subscribe() {
  const items = [55963911];
  ticker.subscribe(items);
  ticker.setMode(ticker.modeFull, items);
}
