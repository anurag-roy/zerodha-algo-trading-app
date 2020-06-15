const KiteConnect = require("kiteconnect").KiteConnect;
const KiteTicker = require("kiteconnect").KiteTicker;
const express = require("express");
const fs = require("fs");
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

app.use("/startLive", (req, res) => {
  res.send("Started Live. Check console.");
});

app.post("/startTrading", ({ body }, res) => {
  useStrategy(body.stockA, body.stockB, body.quantity, body.ltpDifference, body.exitDifference);
  res.send("Trade started. Check console for further details");
});

app.listen(8000, () => {
  console.log("Server started on port 8000");
});

const useStrategy = (stockUno, stockDos, quantity, ltpDiff, exitDiff) => {
  let aLTP, bLTP, aInstrumentToken, bInstrumentToken;
  let stockA = {},
    stockB = {};
  let buyersBidForA, sellersBidForA, buyersBidForB, sellersBidForB;
  let enteredMarket = false,
    exitedMarket = false;
  let caseNumber = 0;

  // Order function
  const order = (stock, transactionType, price) => {
    // kc.placeOrder("regular", {
    //   exchange: stock.exchange,
    //   tradingsymbol: stock.tradingsymbol,
    //   transaction_type: transactionType,
    //   quantity,
    //   product: "MIS",
    //   order_type: "MARKET",
    //   // price: price,
    // }).catch((error) => {
    //   console.log("Error while placing order", error);
    // });
    console.log(
      `Order placed for ${stock.exchange}:${stock.tradingsymbol}, Transaction: ${transactionType}, price: ${price}, quantity: ${quantity}`,
    );
  };

  // Checks Market Exit Condition
  const checkExitCondition = (price1, price2) => {
    if (price1 - price2 <= exitDiff) {
      return true;
    } else return false;
  };

  //Market Exit Order
  const exitMarket = (stock1, stock2, price1, price2) => {
    if (exitedMarket === false) {
      exitedMarket = true;
      order(stock1, "BUY", price1);
      order(stock2, "SELL", price2);
      console.log("Exited Market");
    }
  };

  // Market Exit Logic
  const lookForExit = (ticks) => {
    ticks.forEach((t) => {
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
        const { buy, sell } = t.depth;
        buyersBidForA = buy[0].price;
        sellersBidForA = sell[0].price;
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
        const { buy, sell } = t.depth;
        buyersBidForB = buy[0].price;
        sellersBidForB = sell[0].price;
      }

      if (caseNumber === 1) {
        console.log("Looking for exit...[Entered Case 1]");
        console.log(`${stockA.exchange}:${stockA.tradingsymbol} Sellers Bid: ${sellersBidForA}`);
        console.log(`${stockB.exchange}:${stockB.tradingsymbol} Buyers Bid: ${buyersBidForB}`);
        console.log(`Given: ${exitDiff}, Difference: ${sellersBidForA - buyersBidForB}`);
        if (checkExitCondition(sellersBidForA, buyersBidForB)) {
          exitMarket(stockA, stockB, sellersBidForA, buyersBidForB);
        }
      } else if (caseNumber === 2) {
        console.log("Looking for exit...[Entered Case 2]");
        console.log(`${stockB.exchange}:${stockB.tradingsymbol} Sellers Bid: ${sellersBidForB}`);
        console.log(`${stockA.exchange}:${stockA.tradingsymbol} Buyers Bid: ${buyersBidForA}`);
        console.log(`Given: ${exitDiff}, Difference: ${sellersBidForB - buyersBidForA}`);
        if (checkExitCondition(sellersBidForB, buyersBidForA)) {
          exitMarket(stockB, stockA, sellersBidForB, buyersBidForA);
        }
      }
    });
  };

  // Checks Market Entry Condition
  const checkEntryCondition = (aLTP, bLTP, c, d, f, e) => {
    if (aLTP > bLTP && c - d >= ltpDiff) {
      return 1;
    } else if (bLTP > aLTP && f - e >= ltpDiff) {
      return 2;
    } else return 0;
  };

  // Market Entry Order
  const enterMarket = (stock1, stock2, price1, price2) => {
    // TODO: Enter this into the ledger
    if (enteredMarket === false) {
      enteredMarket = true;
      console.log("Entered market");
      order(stock1, "SELL", price1);
      order(stock2, "BUY", price2);
    }
  };

  // Market Entry Logic which is run on each tick
  const lookForEntry = (ticks) => {
    ticks.forEach((t) => {
      //console.log(t);
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
        const { buy, sell } = t.depth;
        buyersBidForA = buy[0].price;
        sellersBidForA = sell[0].price;
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
        const { buy, sell } = t.depth;
        buyersBidForB = buy[0].price;
        sellersBidForB = sell[0].price;
      }
      console.log("Looking for entry...");
      console.log(
        `${stockA.exchange}:${stockA.tradingsymbol} LTP: ${aLTP}, Buyers Bid: ${buyersBidForA}, Sellers Bid: ${sellersBidForA}`,
      );
      console.log(
        `${stockB.exchange}:${stockB.tradingsymbol} LTP: ${bLTP}, Buyers Bid: ${buyersBidForB}, Sellers Bid: ${sellersBidForB}`,
      );

      const condition = checkEntryCondition(
        aLTP,
        bLTP,
        buyersBidForA,
        sellersBidForB,
        buyersBidForB,
        sellersBidForA,
      );

      if (condition === 1) {
        caseNumber = 1;
        enterMarket(stockA, stockB, buyersBidForA, sellersBidForB);
      } else if (condition === 2) {
        caseNumber = 2;
        enterMarket(stockB, stockA, buyersBidForB, sellersBidForA);
      }
    });
  };

  kc.getLTP([
    `${stockUno.exchange}:${stockUno.tradingsymbol}`,
    `${stockDos.exchange}:${stockDos.tradingsymbol}`,
  ])
    .then((result) => {
      console.log("Got LTPs", result);
      aLTP = result[`${stockUno.exchange}:${stockUno.tradingsymbol}`].last_price;
      bLTP = result[`${stockDos.exchange}:${stockDos.tradingsymbol}`].last_price;
      aInstrumentToken = result[`${stockUno.exchange}:${stockUno.tradingsymbol}`].instrument_token;
      bInstrumentToken = result[`${stockDos.exchange}:${stockDos.tradingsymbol}`].instrument_token;
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
        ticker.setMode(ticker.modeFull, items);
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
