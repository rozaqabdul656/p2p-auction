


// Helper functions for encoding/decoding
function decode(message) {
    return JSON.parse(message.toString('utf-8'));
}

function encode(message) {
    return Buffer.from(JSON.stringify(message), 'utf-8');
}

// Function to print auction details
function printAuctionDetails(action, auction) {
    console.log(`${action}: sell ${auction.item} for ${auction.price} USDt`);
  }
  
  // Function to print bid details
  function printBidDetails(bid) {
    console.log(`Bid: Client#${bid.clientId} makes bid for ${bid.item} with ${bid.amount} USDt`);
  }
  
  // Function to print auction close details
  function printAuctionClose(details) {
    console.log(`Auction closed: ${details.item} sold to Client#${details.winner} for ${details.finalPrice} USDt`);
  }

module.exports = {
    decode,
    encode,
    printAuctionDetails,
    printBidDetails,
    printAuctionClose
}