const HyperswarmRPC = require('@hyperswarm/rpc');
const Hypercore = require('hypercore');
const Hyperbee = require('hyperbee');
const DHT = require('hyperdht');
const crypto = require('crypto');
const path = require('path');
const helper = require('./helper/index');

// Initialize Hypercore and Hyperbee for persistent storage
const auctionCore = new Hypercore(path.join(__dirname, 'server_auctions'), { valueEncoding: 'json' });
const hbee = new Hyperbee(auctionCore, { valueEncoding: 'json' });


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
  const server = rpcServer.createServer();
  await server.listen();
  console.log('RPC server listening with public key:', server.publicKey.toString('hex'));

  console.log('Server is listening for connections...');

  // Handle openAuction requests from clients
  server.respond('openAuction', async (encodedAuction, rpc) => {
    const auction = helper.decode(encodedAuction);
    console.log('Auction received from client:', auction);

    // Broadcast the auction to all other connected clients
    for (const peer of server.connections) {
      if (peer !== rpc) {
        peer.request('openAuction', helper.encode(auction));
      }
    }
  });

  // Handle bid submissions from clients
  server.respond('makeBid', async (encodedBid, rpc) => {
    const bid = helper.decode(encodedBid);
    console.log('Bid received from client:', bid);

    // Broadcast the bid to all other connected clients
    for (const peer of server.connections) {
      if (peer !== rpc) {
        peer.request('makeBid', helper.encode(bid));
      }
    }
  });

  // Handle auction closure requests from clients
  server.respond('closeAuction', async (encodedAuction, rpc) => {
    const auctionDetails = helper.decode(encodedAuction);
    console.log('Auction closed:', auctionDetails);

    // Broadcast auction closure to all other connected clients
    for (const peer of server.connections) {
      if (peer !== rpc) {
        peer.request('closeAuction', helper.encode(auctionDetails));
      }
    }
  });
}

// Start the auction server
startServer().catch(err => console.error('Error starting server:', err));
