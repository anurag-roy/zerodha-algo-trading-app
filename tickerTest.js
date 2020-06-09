const KiteTicker = require("kiteconnect").KiteTicker;

const ticker = new KiteTicker({
  api_key: "2rtrb58mdwkhu7s7",
  access_token: "yIz5gK3yiJ2yaS79U6fcvTDX7hpIizU1",
});

ticker.connect();
ticker.on("ticks", onTicks);
ticker.on("connect", subscribe);

function onTicks(ticks) {
  console.log("Ticks", ticks);
}

function subscribe() {
  const items = [11625730, 24508418];
  ticker.subscribe(items);
  ticker.setMode(ticker.modeQuote, items);
}
