const fs = require("fs");
const express = require("express");
const app = express();
const cors = require("cors");

const instruments = JSON.parse(fs.readFileSync("./instruments.json"));

app.use(cors());
app.use(express.json());

app.get("/mapper", (request, response) => {
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

app.listen(8000, () => {
  console.log("Server started at port 8000");
});
