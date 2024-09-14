const HyperswarmRPC = require('@hyperswarm/rpc');
const Hypercore = require('hypercore');
const Hyperbee = require('hyperbee');
const DHT = require('hyperdht');
const crypto = require('crypto');
const path = require('path');
const helper = require('./helper/index');

// Initialize Hypercore and Hyperbee for persistent storage
const auctionCore = new Hypercore(path.join(__dirname, 'server_auctions'));
const hbee = new Hyperbee(auctionCore, { keyEncoding: 'utf-8', valueEncoding: 'binary' });
let server;

// Start server with DHT and RPC
async function startServer() {
  // Start Distributed Hash Table (DHT)
  let dhtSeed =(await hbee.get('dht-seeds'))?.value;
  if (!dhtSeed) {
    dhtSeed = crypto.randomBytes(32);
    await hbee.put('dht-seeds', dhtSeed);
  }
  const dht = new DHT({
    port: 40001,
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: '127.0.0.1', port: 30001 }] // Update to your bootstrap node
  });

  // Resolve RPC server seed from Hyperbee
  let rpcSeed = (await hbee.get('rpc-seeds'))?.value;
  if (!rpcSeed) {
    rpcSeed = crypto.randomBytes(32);
    await hbee.put('rpc-seeds', rpcSeed);
  }

  // Setup RPC Server using Hyperswarm RPC and DHT
  const rpcServer = new HyperswarmRPC({ seed: rpcSeed, dht });

  // Start listening for incoming connections on the server
  server = rpcServer.createServer();
  await server.listen();
  console.log('RPC server listening with public key:', server.publicKey.toString('hex'));

  console.log('Server is listening for connections...');

  // Handle openAuction requests from clients
  server.respond('openAuction', async (encodedAuction, rpc) => {
    const auction = helper.decode(encodedAuction);
    console.log('Auction received from client:', auction);
    const existingAuction = await hbee.get(`auction/${auction.item}`);
    if (existingAuction) {
      throw new Error(`Auction for ${auction.item} already exists.`);
    }

    await hbee.put(`auction/${auction.item}`, helper.encode(auction));
    broadcast(rpc, 'openAuction', auction);
  });

  // Handle bid submissions from clients
  server.respond('makeBid', async (encodedBid, rpc) => {
    const bid = helper.decode(encodedBid);
    console.log('Bid received from client:', bid);
    // Check if the auction item is closed
    const closedAuction = await hbee.get(`closedAuction/${bid.item}`);
    if (closedAuction) {
      throw new Error(`Auction for ${bid.item} is already closed.`);
    }
    await hbee.put(`bid/${bid.item}/${bid.clientId}`, helper.encode(bid));
    broadcast(rpc, 'makeBid', bid);
  });

  // Handle auction closure requests from clients
  server.respond('closeAuction', async (encodedAuction, rpc) => {
    const auctionDetails = helper.decode(encodedAuction);
    console.log('Auction closed:', auctionDetails);

    // Check if the auction item is already closed
    const existingAuction = await hbee.get(`auction/${auctionDetails.auction}`);
    if (!existingAuction) {
      throw new Error(`Auction for ${auctionDetails.auction} does not exist.`);
    }
    // del to auction items
    await hbee.del(`auction/${auctionDetails.auction}`);

    //put closed auction
    await hbee.put(`closedAuction/${auctionDetails.item}`, helper.encode(auctionDetails));
    broadcast(rpc, 'closeAuction', auctionDetails);
  });

  process.on('SIGINT', async () => {
    console.log("Shutting down server...")
    await rpcServer.destroy();
    await hbee.close();
    process.exit();
  });
}

function broadcast(rpc, type, bid){
    // Broadcast the bid to all other connected clients
    for (const peer of server.connections) {
      if (peer !== rpc) {
        peer.request(type, helper.encode(bid));
      }
    }
}

// Start the auction server
startServer().catch(err => console.error('Error starting server:', err));
