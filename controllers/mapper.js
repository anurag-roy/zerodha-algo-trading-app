const fs = require("fs");
const mapperRouter = require("express").Router();

const instruments = JSON.parse(fs.readFileSync("./instruments.json"));

app.get("/", (request, response) => {
  const exchange = request.query.exchange;
  response.json(
    instruments
      .filter((i) => i.exchange === exchange)
      .filter((i) => (exchange === "BSE" ? i : i.instrument_type === "FUT"))
      .map((i) => {
        return {
          instrumentToken: i.instrument_token,
          tradingSymbol: i.tradingsymbol,
          instrumentType: i.instrument_type,
          exchange: i.exchange,
        };
      }),
  );
});

module.exports = mapperRouter;
