const KiteConnect = require("kiteconnect").KiteConnect;
const KiteTicker = require("kiteconnect").KiteTicker;
const express = require("express");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(express.json());

const apiKey = process.env.API_KEY;
const accessToken = process.env.ACCESS_TOKEN;

const kc = new KiteConnect({
  api_key: apiKey,
});
kc.setAccessToken(accessToken);

console.log("All set!");

app.use("/startLive", (req, res) => {
  res.send("Started Live. Check console.");
});

app.post("/startTrading", ({ body }, res) => {
  useStrategy(body.stockA, body.stockB, body.quantity, body.entryDifference, body.exitDifference);
  res.send("Trade started. Check console for further details");
});

app.post("/unexecuted", ({ body }, res) => {
  unexecutedLogic(body.stockToBuy, body.stockToSell, body.exitDiff, body.quantity);
  res.send("Unexecuted started. Check console for further details");
});

app.listen(8001, () => {
  console.log("Server started on port 8001");
});

const useStrategy = (stockUno, stockDos, quantity, entryDiff, exitDiff) => {
  let aLTP, bLTP, aInstrumentToken, bInstrumentToken;
  let stockA = {},
    stockB = {};
  let buyersBidForA, sellersBidForA, buyersBidForB, sellersBidForB;
  let enteredMarket = false,
    exitedMarket = false;

  // Order function
  const order = (stock, transactionType, price) => {
    // kc.placeOrder("regular", {
    //   exchange: stock.exchange,
    //   tradingsymbol: stock.tradingsymbol,
    //   transaction_type: transactionType,
    //   quantity,
    //   product: "MIS",
    //   order_type: "MARKET",
    //   price: ltp,
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
  const exitMarket = (stock, price, transactionType) => {
    if (exitedMarket === false) {
      exitedMarket = true;
      order(stock, transactionType, price);
      console.log("Exited Market");
    }
  };

  // Market Exit Logic
  const lookForExit = (ticks) => {
    ticks.forEach((t) => {
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
      } else if (t.instrument_token === bInstrumentToken) {
        const { buy, sell } = t.depth;
        buyersBidForB = buy[0].price;
        sellersBidForB = sell[0].price;
      }
      console.log("Looking for Exit...");
      console.log(`${stockA.exchange}:${stockA.tradingsymbol} LTP: ${aLTP}`);
      console.log(`${stockB.exchange}:${stockB.tradingsymbol} Sellers Bid: ${sellersBidForB}`);
      console.log(
        `[Looking for Exit (Given: ${exitDiff})] LTP Difference: ${sellersBidForB - aLTP}`,
      );

      if (checkExitCondition(sellersBidForB, aLTP)) {
        exitMarket(stockB, sellersBidForB, "BUY");
      }
    });
  };

  // Checks Market Entry Condition
  const checkEntryCondition = (price1, price2) => {
    if (price1 - price2 >= entryDiff) {
      return true;
    } else return false;
  };

  // Market Entry Order
  const enterMarket = (stock, price, transactionType) => {
    // TODO: Enter this into the ledger
    if (enteredMarket === false) {
      enteredMarket = true;
      console.log("Entered market");
      order(stock, transactionType, price);
    }
  };

  // Market Entry Logic which is run on each tick
  const lookForEntry = (ticks) => {
    ticks.forEach((t) => {
      //console.log(t);
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
      } else if (t.instrument_token === bInstrumentToken) {
        if (t.depth.buy) {
          buyersBidForB = t.depth.buy[0].price;
        }
        if (t.depth.sell) {
          sellersBidForB = t.depth.sell[0].price;
        }
      }
      console.log("Looking for entry...");
      console.log(`${stockA.exchange}:${stockA.tradingsymbol} LTP: ${aLTP}`);
      console.log(`${stockB.exchange}:${stockB.tradingsymbol} Buyers Bid: ${buyersBidForB}`);
      console.log(
        `[Looking for Entry (Given: ${EntryDiff})] LTP Difference: ${buyersBidForB - aLTP}`,
      );

      if (checkEntryCondition(buyersBidForB, aLTP)) {
        enterMarket(stockB, buyersBidForB, "SELL");
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
