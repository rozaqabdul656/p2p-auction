


// Helper functions for encoding/decoding
function decode(message) {
    return JSON.parse(message.toString('utf-8'));
}

function encode(message) {
    return Buffer.from(JSON.stringify(message), 'utf-8');
}

module.exports = {
    decode,
    encode
}