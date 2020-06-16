const unexecutedLogic = (stockToBuy, stockToSell, exitDiff, quantity) => {
  let aInstrumentToken, bInstrumentToken;
  let stockA = {},
    stockB = {};
  let sellersBidForA, buyersBidForB;
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
        if (t.depth) {
          if (t.depth.sell) {
            sellersBidForA = t.depth.sell[0].price;
          }
        }
      } else if (t.instrument_token === bInstrumentToken) {
        if (t.depth) {
          if (t.depth.buy) {
            buyersBidForB = t.depth.buy[0].price;
          }
        }
      }

      console.log(`Looking for exit...
        ${stockA.exchange}:${stockA.tradingsymbol} Sellers Bid: ${sellersBidForA}
        ${stockB.exchange}:${stockB.tradingsymbol} Buyers Bid: ${buyersBidForB}
        Given: ${exitDiff}, Difference: ${sellersBidForA - buyersBidForB}`);
      if (checkExitCondition(sellersBidForA, buyersBidForB)) {
        exitMarket(stockA, stockB, sellersBidForA, buyersBidForB);
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
        return "Unexecuted Trade completed succesfully.";
      });
    })
    .catch((error) => {
      console.log("Error fetching LTP for the stocks: ", error);
    });
};
