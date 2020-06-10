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
  res.send("Started Live. Check console.");
});

app.post("/startTrading", (req, res) => {
  useStrategy(
    { exchange: "MCX", tradingsymbol: "GOLDPETAL20JULFUT" },
    { exchange: "MCX", tradingsymbol: "GOLDPETAL20JUNFUT" },
    1,
    0,
    0
  ).then((result) => {
    return result;
  });
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
  let enteredMarket = false,
    exitedMarket = false;

  // Order function
  const order = (stock, transactionType, ltp) => {
    kc.placeOrder("regular", {
      exchange: stock.exchange,
      tradingsymbol: stock.tradingsymbol,
      transaction_type: transactionType,
      quantity,
      product: "NRML",
      order_type: "LIMIT",
      price: ltp,
    }).catch((error) => {
      console.log("Error while placing order", error);
    });
    console.log(
      `Order placed for ${stock.exchange}:${stock.tradingsymbol} of transaction ${transactionType} quantity ${quantity}`
    );
  };

  // Checks Market Exit Condition
  const checkExitCondition = (ltp1, ltp2) => {
    if (ltp1 - ltp2 <= 1.01 * exitDiff) {
      return true;
    } else return false;
  };

  //Market Exit Order
  const exitMarket = (stock1, stock2) => {
    if (exitedMarket === false) {
      exitedMarket = true;
      order(stock1, "BUY", aLTP);
      order(stock2, "SELL", bLTP);
      console.log("Completed");
    }
  };

  // Market Exit Logic
  const lookForExit = (ticks) => {
    ticks.forEach((t) => {
      console.log(t);
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
      }
      console.log(
        `[Looking for Exit (Given: ${exitDiff})] Current LTP Difference: ${
          aLTP - bLTP
        }`
      );
      if (checkExitCondition(aLTP, bLTP)) {
        exitMarket(stockA, stockB);
      }
    });
  };

  // Checks Market Entry Condition
  const checkEntryCondition = (ltp1, ltp2) => {
    if (ltp1 > ltp2 && ltp1 - ltp2 >= 1.01 * ltpDiff) {
      return 1;
    } else if (ltp2 > ltp1 && ltp2 - ltp1 >= 1.01 * ltpDiff) {
      return 2;
    } else return 0;
  };

  // Market Entry Order
  const enterMarket = (stock1, stock2) => {
    // TODO: Enter this into the ledger
    if (enteredMarket === false) {
      enteredMarket = true;
      console.log("Entered market");
      order(stock1, "SELL", aLTP);
      order(stock2, "BUY", bLTP);
    }
  };

  // Market Entry Logic which is run on each tick
  const lookForEntry = (ticks) => {
    ticks.forEach((t) => {
      console.log(t);
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
      }
      console.log(`(Looking for entry) LTP Difference: ${aLTP - bLTP}`);
      const condition = checkEntryCondition(aLTP, bLTP);

      if (condition === 1) {
        enterMarket(stockA, stockB);
      }
    });
  };

  kc.getLTP([
    `${stockUno.exchange}:${stockUno.tradingsymbol}`,
    `${stockDos.exchange}:${stockDos.tradingsymbol}`,
  ])
    .then((result) => {
      console.log("Got LTPs", result);
      aLTP =
        result[`${stockUno.exchange}:${stockUno.tradingsymbol}`].last_price;
      bLTP =
        result[`${stockDos.exchange}:${stockDos.tradingsymbol}`].last_price;
      aInstrumentToken =
        result[`${stockUno.exchange}:${stockUno.tradingsymbol}`]
          .instrument_token;
      bInstrumentToken =
        result[`${stockDos.exchange}:${stockDos.tradingsymbol}`]
          .instrument_token;
      stockA = { ...stockUno };
      stockB = { ...stockDos };
    })
    .then(() => {
      var ticker = new KiteTicker({
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

      ticker.on("ticks", (tick) => {
        if (enteredMarket === false) {
          lookForEntry(tick);
        } else if (exitedMarket === false) {
          lookForExit(tick);
        } else if (exitedMarket === true) {
          ticker.disconnect();
        }
      });

      ticker.on("close", () => {
        return "Trade completed succesfully.";
      });
    })
    .catch((error) => {
      console.log("Error fetching LTP for the stocks: ", error);
    });
};
