KiteConnect = require("kiteconnect").KiteConnect;
const KiteTicker = require("kiteconnect").KiteTicker;
const express = require("express");
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
  unexecutedLogic(body.futureToBuy, body.futureToSell, body.quantity, body.exitDifference);
  res.send("Unexecuted started. Check console for further details");
});

app.listen(8008, () => {
  console.log("Server started on port 8008");
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
    //   product: "NRML",
    //   order_type: "MARKET",
    //   // price: price,
    // }).catch((error) => {
    //   console.log("Error while placing order", error);
    // });
    const timestamp = new Date();
    console.log(
      `Order placed for ${stock.exchange}:${stock.tradingsymbol}, Transaction: ${transactionType}, price: ${price}, quantity: ${quantity}`,
    );
    console.log(`Time of order: ${timestamp.toUTCString()}`);
  };

  // Checks Market Exit Condition
  const checkExitCondition = (price1, price2) => {
    if (price1 + price2 <= exitDiff) {
      return true;
    } else return false;
  };

  //Market Exit Order
  const exitMarket = (stock1, stock2, price1, price2) => {
    if (exitedMarket === false) {
      exitedMarket = true;
      order(stock1, "BUY", price1);
      order(stock2, "BUY", price2);
      console.log("Exited Market");
    }
  };

  // Market Exit Logic
  const lookForExit = (ticks) => {
    ticks.forEach((t) => {
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
        if (t.depth) {
          if (t.depth.buy) {
            buyersBidForA = t.depth.buy[1].price;
          }
          if (t.depth.sell) {
            sellersBidForA = t.depth.sell[1].price;
          }
        }
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
        if (t.depth) {
          if (t.depth.buy) {
            buyersBidForB = t.depth.buy[1].price;
          }
          if (t.depth.sell) {
            sellersBidForB = t.depth.sell[1].price;
          }
        }
      }

      console.log(`Looking for exit...
        ${stockA.exchange}:${stockA.tradingsymbol} Sellers Bid: ${sellersBidForA} 
        ${stockB.exchange}:${stockB.tradingsymbol} Sellers Bid: ${sellersBidForB} 
        Given: ${exitDiff}, Current Sum: ${sellersBidForA + sellersBidForB}`);

      if (checkExitCondition(sellersBidForA, sellersBidForB)) {
        exitMarket(stockA, stockB, sellersBidForA, sellersBidForB);
      }
    });
  };

  // Checks Market Entry Condition
  const checkEntryCondition = (price1, price2) => {
    if (price1 + price2 >= entryDiff) {
      return true;
    } else return false;
  };

  // Market Entry Order
  const enterMarket = (stock1, stock2, price1, price2) => {
    if (enteredMarket === false) {
      enteredMarket = true;
      console.log("Entered market");
      order(stock1, "SELL", price1);
      order(stock2, "SELL", price2);
    }
  };

  // Market Entry Logic which is run on each tick
  const lookForEntry = (ticks) => {
    ticks.forEach((t) => {
      //console.log(t);
      if (t.instrument_token === aInstrumentToken) {
        aLTP = t.last_price;
        if (t.depth) {
          if (t.depth.buy) {
            buyersBidForA = t.depth.buy[1].price;
          }
          if (t.depth.sell) {
            sellersBidForA = t.depth.sell[1].price;
          }
        }
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
        if (t.depth) {
          if (t.depth.buy) {
            buyersBidForB = t.depth.buy[1].price;
          }
          if (t.depth.sell) {
            sellersBidForB = t.depth.sell[1].price;
          }
        }
      }
      console.log(`Looking for entry...
      ${stockA.exchange}:${stockA.tradingsymbol} LTP: ${aLTP}, Buyers Bid: ${buyersBidForA} 
      ${stockB.exchange}:${stockB.tradingsymbol} LTP: ${bLTP}, Buyers Bid: ${buyersBidForB}
      Given: ${entryDiff}, Current Sum: ${buyersBidForA + buyersBidForB}`);

      if (checkEntryCondition(buyersBidForA, buyersBidForB)) {
        enterMarket(stockA, stockB, buyersBidForA, buyersBidForB);
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
        return "Trade completed successfully.";
      });
    })
    .catch((error) => {
      console.log("Error fetching LTP for the stocks: ", error);
    });
};

const unexecutedLogic = (stockToBuy, stockToSell, quantity, exitDiff) => {
  let aInstrumentToken, bInstrumentToken;
  let stockA = {},
    stockB = {};
  let sellersBidForA, sellersBidForB;
  let exitedMarket = false;

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
    const timestamp = new Date();
    console.log(
      `Order placed for ${stock.exchange}:${stock.tradingsymbol}, Transaction: ${transactionType}, price: ${price}, quantity: ${quantity}`,
    );
    console.log(`Time of order: ${timestamp.toUTCString()}`);
  };

  // Checks Market Exit Condition
  const checkExitCondition = (price1, price2) => {
    if (price1 + price2 <= exitDiff) {
      return true;
    } else return false;
  };

  //Market Exit Order
  const exitMarket = (stock1, stock2, price1, price2) => {
    if (exitedMarket === false) {
      exitedMarket = true;
      order(stock1, "BUY", price1);
      order(stock2, "BUY", price2);
      console.log("Exited Market");
    }
  };

  // Market Exit Logic
  const lookForExit = (ticks) => {
    ticks.forEach((t) => {
      if (t.instrument_token === aInstrumentToken) {
        if (t.depth) {
          if (t.depth.sell) {
            sellersBidForA = t.depth.sell[1].price;
          }
        }
      } else if (t.instrument_token === bInstrumentToken) {
        if (t.depth) {
          if (t.depth.sell) {
            sellersBidForB = t.depth.sell[1].price;
          }
        }
      }

      console.log(`Looking for exit...
        ${stockA.exchange}:${stockA.tradingsymbol} Sellers Bid: ${sellersBidForA} 
        ${stockB.exchange}:${stockB.tradingsymbol} Sellers Bid: ${sellersBidForB} 
        Given: ${exitDiff}, Current Sum: ${sellersBidForA + sellersBidForB}`);

      if (checkExitCondition(sellersBidForA, sellersBidForB)) {
        exitMarket(stockA, stockB, sellersBidForA, sellersBidForB);
      }
    });
  };

  kc.getLTP([
    `${stockToBuy.exchange}:${stockToBuy.tradingsymbol}`,
    `${stockToSell.exchange}:${stockToSell.tradingsymbol}`,
  ])
    .then((result) => {
      console.log("Got LTPs", result);
      //   aLTP = result[`${stockToBuy.exchange}:${stockToBuy.tradingsymbol}`].last_price;
      //   bLTP = result[`${stockToSell.exchange}:${stockToSell.tradingsymbol}`].last_price;
      aInstrumentToken =
        result[`${stockToBuy.exchange}:${stockToBuy.tradingsymbol}`].instrument_token;
      bInstrumentToken =
        result[`${stockToSell.exchange}:${stockToSell.tradingsymbol}`].instrument_token;
      stockA = { ...stockToBuy };
      stockB = { ...stockToSell };
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
        if (exitedMarket === false) {
          lookForExit(tick);
        } else if (exitedMarket === true) {
          ticker.disconnect();
        }
      });

      ticker.on("close", () => {
        return "Unexecuted Trade completed successfully.";
      });
    })
    .catch((error) => {
      console.log("Error fetching LTP for the stocks: ", error);
    });
};
