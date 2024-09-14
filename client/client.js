const HyperswarmRPC = require('@hyperswarm/rpc');
const Hypercore = require('hypercore');
const Hyperbee = require('hyperbee');
const DHT = require('hyperdht');
const crypto = require('crypto');
const path = require('path');
const helper = require('./helper/index');

// Initialize Hypercore and Hyperbee for persistent storage
const auctionCore = new Hypercore(path.join(__dirname, 'client_auctions'), { valueEncoding: 'json' });
const hbee = new Hyperbee(auctionCore, { valueEncoding: 'json' });


// Start client with DHT and RPC
async function startClient() {
  if (!process.argv[2]){
    throw new Error('Please provide public key as parameter')
  }
  // Start Distributed Hash Table (DHT)
    // Resolve RPC client seed from Hyperbee
  let dhtSeed = (await hbee.get('dht-seeds'))?.value;
  if (!dhtSeed) {
    dhtSeed = crypto.randomBytes(32);
    await hbee.put('dht-seed', dhtSeed);
  }
  const dht = new DHT({
    port: 40002,
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: '127.0.0.1', port: 30001 }] // Update to your bootstrap node
  });

  // Resolve RPC client seed from Hyperbee
  let rpcSeed = (await hbee.get('rpc-seeds'))?.value;
  if (!rpcSeed) {
    rpcSeed = crypto.randomBytes(32);
    await hbee.put('rpc-seed', rpcSeed);
  }

  // Setup RPC Client using Hyperswarm RPC and DHT
  const rpc = new HyperswarmRPC({ seed: rpcSeed, dht });
  const client = rpc.connect(Buffer.from(process.argv[2], 'hex'));

  client.on('open', () => console.log('Connected to DHT peer via RPC'));
  
  // Handle responses from peers
  client.rpc.respond('openAuction', async (encodedAuction) => {
    const auction = helper.decode(encodedAuction);
    console.log('New auction opened:', auction);
  });

  client.rpc.respond('makeBid', async (encodedBid) => {
    const bid = helper.decode(encodedBid);
    console.log('New bid placed:', bid);
  });

  client.rpc.respond('closeAuction', async (encodedClosure) => {
    const closure = helper.decode(encodedClosure);
    console.log('Auction closed:', closure);
  });

  return client;
}

// Open an auction
async function openAuction(client, auction) {
  const encodedAuction = helper.encode(auction);
  await client.rpc.request('openAuction', encodedAuction);
  console.log('Auction opened:', auction);
}

// Make a bid
async function makeBid(client, bid) {
  const encodedBid = helper.encode(bid);
  await client.rpc.request('makeBid', encodedBid);
  console.log('Bid placed:', bid);
}

// Close an auction
async function closeAuction(client, closure) {
  const encodedClosure = helper.encode(closure);
  await client.rpc.request('closeAuction', encodedClosure);
  console.log('Auction closed:', closure);
}

// Start the client and demonstrate actions
async function runDemo() {
  const client = await startClient();

  // Example actions
  const auction1 = { item: 'Pic#1', price: '75 USDt' };
  const auction2 = { item: 'Pic#2', price: '60 USDt' };

  await openAuction(client, auction1);
  await openAuction(client, auction2);

  const bid1 = { auction: 'Pic#1', bidder: 'Client#2', amount: '75 USDt' };
  const bid2 = { auction: 'Pic#1', bidder: 'Client#3', amount: '75.5 USDt' };
  const bid3 = { auction: 'Pic#1', bidder: 'Client#2', amount: '80 USDt' };

  await makeBid(client, bid1);
  await makeBid(client, bid2);
  await makeBid(client, bid3);

  const closure = { auction: 'Pic#1', winner: 'Client#2', finalPrice: '80 USDt' };
  await closeAuction(client, closure);
}

// Run the demo
runDemo().catch(err => console.error('Error running demo:', err));
