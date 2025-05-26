const axios = require("axios");
const crypto = require("crypto");
class StockHandler {
  constructor(db) {
    this.db = db;
  }
  hashIP(ip) {
    return crypto.createHash('sha256').update(ip).digest('hex');
  }
  /**
   * Return array of likes for each symbol in the same order as symbols
   * @param {array} symbols
   */
  async getLikes(symbols) {
    const likes = []; 
    for (const symbol of symbols) {
      const count = await this.db
        .collection("Likes")
        .countDocuments({ symbol });
      likes.push(count);
    }
    return likes;
  }
  async saveLike(symbol, ip) {
    if (!symbol || !ip) return false;
    const hashedIP = this.hashIP(ip);
    try {
      await this.db.collection("Likes").updateOne(
        { symbol, ip: hashedIP },
        { $set: { symbol, ip: hashedIP } },
        { upsert: true }
      );
      return true;
    } catch (error) {
      throw error;
    }
  }
  async getQuote(stockSymbol) {
    if (!stockSymbol) return false; 
    try {
      const response = await axios.get(
        `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockSymbol}/quote`
      );
      const { symbol: stock, latestPrice: price } = response.data;
      return { stock: stock.toUpperCase(), price };
    } catch (error) {
      console.error(`Error fetching quote for ${stockSymbol}:`, error.message);
      throw error;
    }
  }
  async getStockData(symbols, ip, like) {
    try {   
      if (like && ip) {
        for (const symbol of symbols) {
          if (symbol) {
            await this.saveLike(symbol, ip);
          }
        }
      }
      const quotes = [];
      for (const symbol of symbols) {
        if (symbol) {
          const quote = await this.getQuote(symbol);
          if (quote) {
            quotes.push(quote);
          }
        }
      }
      if (quotes.length === 0) {
        throw new Error("No valid stock data found");
      }
      const likes = await this.getLikes(symbols.filter(Boolean));
      if (quotes.length === 1) {
        return {
          stockData: {
            ...quotes[0],
            likes: likes[0]
          }
        };
      } else {
        const stockData = quotes.map(quote => {
          const symbolIndex = symbols.findIndex(s => s && s.toUpperCase() === quote.stock);
          const likeCount = likes[symbolIndex] || 0;
          return { ...quote, likes: likeCount };
        });
        const finalStockData = stockData.map((stock, index) => ({
          stock: stock.stock,
          price: stock.price,
          rel_likes: stock.likes - stockData[1 - index].likes
        }));
        return { stockData: finalStockData };
      }
    } catch (error) {
      console.error("Error in getStockData:", error.message);
      throw error;
    }
  }
}
module.exports = StockHandler;