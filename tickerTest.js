const KiteTicker = require("kiteconnect").KiteTicker;

const ticker = new KiteTicker({
  api_key: "2rtrb58mdwkhu7s7",
  access_token: "ZGaVZqFgY1vetA1jHZCuZL8J5ZB3DpLH",
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
