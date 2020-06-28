const KiteConnect = require("kiteconnect").KiteConnect;
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

app.listen(8000, () => {
  console.log("Server started on port 8000");
});

const useStrategy = (stockUno, stockDos, quantity, entryDiff, exitDiff) => {
  let aLTP, bLTP, aInstrumentToken, bInstrumentToken;
  let stockA = {},
    stockB = {};
  let buyersBidForA,
    buyersQtyForA,
    sellersBidForA,
    sellersQtyForA,
    buyersBidForB,
    buyersQtyForB,
    sellersBidForB,
    sellersQtyForB;
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
    if (price1 - price2 <= exitDiff) {
      return true;
    } else return false;
  };

  //Market Exit Order
  const exitMarket = (
    stock1,
    stock2,
    price1,
    price2,
    sellersQtyFor1,
    buyersQtyFor1,
    buyersQtyFor2,
    sellersQtyFor2,
  ) => {
    if (sellersQtyFor1 >= quantity + buyersQtyFor1 && buyersQtyFor2 >= quantity + sellersQtyFor2) {
      if (exitedMarket === false) {
        exitedMarket = true;
        order(stock1, "BUY", price1);
        order(stock2, "SELL", price2);
        console.log("Exited Market");
      }
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
            buyersQtyForA = t.depth.buy[1].quantity;
          }
          if (t.depth.sell) {
            sellersBidForA = t.depth.sell[1].price;
            sellersQtyForA = t.depth.sell[1].quantity;
          }
        }
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
        if (t.depth) {
          if (t.depth.buy) {
            buyersBidForB = t.depth.buy[1].price;
            buyersQtyForB = t.depth.buy[1].quantity;
          }
          if (t.depth.sell) {
            sellersBidForB = t.depth.sell[1].price;
            sellersQtyForB = t.depth.sell[1].quantity;
          }
        }
      }

      if (caseNumber === 1) {
        console.log(`Looking for exit...[Entered Case 1]
        ${stockA.exchange}:${
          stockA.tradingsymbol
        } Sellers Bid: ${sellersBidForA} (${sellersQtyForA})
        ${stockB.exchange}:${stockB.tradingsymbol} Buyers Bid: ${buyersBidForB} (${buyersQtyForB})
        Given: ${exitDiff}, Difference: ${sellersBidForA - buyersBidForB}`);
        if (checkExitCondition(sellersBidForA, buyersBidForB)) {
          exitMarket(
            stockA,
            stockB,
            sellersBidForA,
            buyersBidForB,
            sellersQtyForA,
            buyersQtyForA,
            buyersQtyForB,
            sellersQtyForB,
          );
        }
      } else if (caseNumber === 2) {
        console.log(`Looking for exit...[Entered Case 2]
        ${stockB.exchange}:${
          stockB.tradingsymbol
        } Sellers Bid: ${sellersBidForB} (${sellersQtyForB})
        ${stockA.exchange}:${stockA.tradingsymbol} Buyers Bid: ${buyersBidForA} (${buyersQtyForA})
        Given: ${exitDiff}, Difference: ${sellersBidForB - buyersBidForA}`);
        if (checkExitCondition(sellersBidForB, buyersBidForA)) {
          exitMarket(
            stockB,
            stockA,
            sellersBidForB,
            buyersBidForA,
            sellersQtyForB,
            buyersQtyForB,
            buyersQtyForA,
            sellersQtyForA,
          );
        }
      }
    });
  };

  // Checks Market Entry Condition
  const checkEntryCondition = (aLTP, bLTP, c, d, f, e) => {
    if (aLTP >= bLTP && c - d >= entryDiff) {
      return 1;
    } else if (bLTP > aLTP && f - e >= entryDiff) {
      return 2;
    } else return 0;
  };

  // Market Entry Order
  const enterMarket = (
    stock1,
    stock2,
    price1,
    price2,
    buyersQtyFor1,
    sellersQtyFor1,
    sellersQtyFor2,
    buyersQtyFor2,
  ) => {
    if (buyersQtyFor1 >= quantity + sellersQtyFor1 && sellersQtyFor2 >= quantity + buyersQtyFor2) {
      if (enteredMarket === false) {
        enteredMarket = true;
        console.log("Entered market");
        order(stock1, "SELL", price1);
        order(stock2, "BUY", price2);
      }
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
            buyersQtyForA = t.depth.buy[1].quantity;
          }
          if (t.depth.sell) {
            sellersBidForA = t.depth.sell[1].price;
            sellersQtyForA = t.depth.sell[1].quantity;
          }
        }
      } else if (t.instrument_token === bInstrumentToken) {
        bLTP = t.last_price;
        if (t.depth) {
          if (t.depth.buy) {
            buyersBidForB = t.depth.buy[1].price;
            buyersQtyForB = t.depth.buy[1].quantity;
          }
          if (t.depth.sell) {
            sellersBidForB = t.depth.sell[1].price;
            sellersQtyForB = t.depth.sell[1].quantity;
          }
        }
      }
      console.log(`Looking for entry...
      ${stockA.exchange}:${stockA.tradingsymbol} LTP: ${aLTP}, Buyers Bid: ${buyersBidForA} (${buyersQtyForA}), Sellers Bid: ${sellersBidForA} (${sellersQtyForA})
      ${stockB.exchange}:${stockB.tradingsymbol} LTP: ${bLTP}, Buyers Bid: ${buyersBidForB} (${buyersQtyForB}), Sellers Bid: ${sellersBidForB} (${sellersQtyForB})`);
      if (aLTP >= bLTP) {
        console.log(`Given: ${entryDiff}, Difference: ${buyersBidForA - sellersBidForB}`);
      } else if (bLTP > aLTP) {
        console.log(`Given: ${entryDiff}, Difference: ${buyersBidForB - sellersBidForA}`);
      }

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
        enterMarket(
          stockA,
          stockB,
          buyersBidForA,
          sellersBidForB,
          buyersQtyForA,
          sellersQtyForA,
          sellersQtyForB,
          buyersQtyForB,
        );
      } else if (condition === 2) {
        caseNumber = 2;
        enterMarket(
          stockB,
          stockA,
          buyersBidForB,
          sellersBidForA,
          buyersQtyForB,
          sellersQtyForB,
          sellersQtyForA,
          buyersQtyForA,
        );
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
  let sellersBidForA, buyersBidForB, buyersQtyForA, sellersQtyForA, buyersQtyForB, sellersQtyForB;
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
    if (price1 - price2 <= exitDiff) {
      return true;
    } else return false;
  };

  //Market Exit Order
  const exitMarket = (
    stock1,
    stock2,
    price1,
    price2,
    sellersQtyFor1,
    buyersQtyFor1,
    buyersQtyFor2,
    sellersQtyFor2,
  ) => {
    if (sellersQtyFor1 >= quantity + buyersQtyFor1 && buyersQtyFor2 >= quantity + sellersQtyFor2) {
      if (exitedMarket === false) {
        exitedMarket = true;
        order(stock1, "BUY", price1);
        order(stock2, "SELL", price2);
        console.log("Exited Market");
      }
    }
  };

  // Market Exit Logic
  const lookForExit = (ticks) => {
    ticks.forEach((t) => {
      if (t.instrument_token === aInstrumentToken) {
        if (t.depth) {
          if (t.depth.sell) {
            sellersBidForA = t.depth.sell[1].price;
            sellersQtyForA = t.depth.sell[1].quantity;
          }
          if (t.depth.buy) {
            buyersQtyForA = t.depth.buy[1].quantity;
          }
        }
      } else if (t.instrument_token === bInstrumentToken) {
        if (t.depth) {
          if (t.depth.buy) {
            buyersBidForB = t.depth.buy[1].price;
            buyersQtyForB = t.depth.buy[1].quantity;
          }
          if (t.depth.sell) {
            sellersQtyForB = t.depth.sell[1].quantity;
          }
        }
      }

      console.log(`Looking for exit...
        ${stockA.exchange}:${
        stockA.tradingsymbol
      } Sellers Bid: ${sellersBidForA} (${sellersQtyForA})
        ${stockB.exchange}:${stockB.tradingsymbol} Buyers Bid: ${buyersBidForB} (${buyersQtyForB})
        Given: ${exitDiff}, Difference: ${sellersBidForA - buyersBidForB}`);
      if (checkExitCondition(sellersBidForA, buyersBidForB)) {
        exitMarket(
          stockA,
          stockB,
          sellersBidForA,
          buyersBidForB,
          sellersQtyForA,
          buyersQtyForA,
          buyersQtyForB,
          sellersQtyForB,
        );
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
