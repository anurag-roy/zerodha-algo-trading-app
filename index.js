const KiteConnect = require("kiteconnect").KiteConnect;
const KiteTicker = require("kiteconnect").KiteTicker;
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
require("dotenv").config();

const app = express();

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

app.use("/startLive", (req, res) => {
  useStrategy(
    { exchange: "NFO", tradingsymbol: "ACC20JULFUT" },
    { exchange: "NFO", tradingsymbol: "ACC20JUNFUT" },
    0,
    0,
    0
  );
  res.send("Started Live. Check console.");
});

app.listen(8000, () => {
  console.log("Server started on port 8000");
});

// kc.getInstruments()
//   .then((res) => {
//     fs.writeFileSync("instruments.json", JSON.stringify(res));
//     console.log("Fetched all the instruments");
//   })
//   .catch((err) => {
//     console.error(err);
//   });

// stockA : {
//   exchange: "NSE",
//   tradingsymbol: "INFY"
// }

const useStrategy = (stockUno, stockDos, quantity, ltpDiff, exitDiff) => {
  let aLTP, bLTP, aInstrumentToken, bInstrumentToken;
  let stockA,
    stockB = {};

  // Order function
  const order = (stock, transactionType) => {
    kc.placeOrder("regular", {
      exchange: stock.exchange,
      tradingsymbol: stock.tradingsymbol,
      transaction_type: transactionType,
      quantity,
      product: "CNC",
      order_type: "NRML",
    });
  };

  // Checks Market Exit Condition
  const checkExitCondition = (ltp1, ltp2) => {
    if (ltp1 - ltp2 <= 1.01 * exitDiff) {
      return true;
    } else return false;
  };

  //Market Exit Order
  const exitMarket = (stock1, stock2) => {
    order(stock1, "BUY");
    order(stock2, "SELL");
    ticker.disconnect();
  };

  // Market Exit Logic
  const lookForExit = (ticks) => {
    ticks.forEach((t) => {
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
      }

      if (checkExitCondition(aLTP, bLTP)) {
        exitMarket(stockA, stockB);
      }
    });
  };

  // Checks Market Entry Condition
  const checkEntryCondition = (ltp1, ltp2) => {
    if (ltp1 > ltp2 && ltp1 - ltp2 >= 1.01 * ltpDiff) {
      return 1;
    } else if (ltpDiff > 1.01 * average) {
      return 3;
    } else return 0;
  };

  // Market Entry Order
  const enterMarket = (stock1, stock2) => {
    // TODO: Enter this into the ledger
    order(stock1, "SELL");
    order(stock2, "BUY");
    onTick = lookForExit;
  };

  // Market Entry Logic which is run on each tick
  const lookForEntry = (ticks) => {
    ticks.forEach((t) => {
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
      }
      const condition = checkEntryCondition(aLTP, bLTP);

      if (condition === 1) {
        enterMarket(stockA, stockB);
      }
    });
  };

  let onTick = lookForEntry;

  kc.getLTP([
    `${stockUno.exchange}:${stockUno.tradingsymbol}`,
    `${stockDos.exchange}:${stockDos.tradingsymbol}`,
  ])
    .then((result) => {
      console.log("Got LTPs", result);
      const unoLTP =
        result[`${stockUno.exchange}:${stockUno.tradingsymbol}`].last_price;
      const dosLTP =
        result[`${stockDos.exchange}:${stockDos.tradingsymbol}`].last_price;

      if (unoLTP >= dosLTP) {
        aLTP = unoLTP;
        bLTP = dosLTP;
        aInstrumentToken =
          result[`${stockUno.exchange}:${stockUno.tradingsymbol}`]
            .instrument_token;
        bInstrumentToken =
          result[`${stockDos.exchange}:${stockDos.tradingsymbol}`]
            .instrument_token;
        stockA = { ...StockUno };
        stockB = { ...StockDos };
      } else {
        aLTP = dosLTP;
        bLTP = unoLTP;
        aInstrumentToken =
          result[`${stockDos.exchange}:${stockDos.tradingsymbol}`]
            .instrument_token;
        bInstrumentToken =
          result[`${stockUno.exchange}:${stockUno.tradingsymbol}`]
            .instrument_token;
        stockA = { ...StockDos };
        stockB = { ...StockUno };
      }
    })
    .then(() => {
      const ticker = new KiteTicker({
        api_key: apiKey,
        access_token: accessToken,
      });

      ticker.connect();

      ticker.on("connect", () => {
        const items = [];
        items.push(aInstrumentToken);
        items.push(bInstrumentToken);
        ticker.subscribe(items);
        ticker.setMode(ticker.modeQuote, items);
      });

      ticker.on("ticks", onTick);
    })
    .catch((error) => {
      console.log("Error fetching LTP for the stocks: ", error);
    });
};
