const dotenv = require('dotenv')
const assert = require('assert');
const config = require('./config.json');
const { TwitterApi } = require('twitter-api-v2');

assert.strictEqual(typeof config, 'object', 'Configuration must be an object');
dotenv.config();

const app = require('express')();

app.get('/auth/twitter/callback', (req, res) => {
    // Extract state and code from query string
    const { state, code } = req.query;
    // Get the saved codeVerifier from session
    var codeVerifier = "IhdE_aEai6QgRMErFI-IeVkfFPAiuC-YYoFhn-dVbOpvfcCGYPoWV32ygaYoeDo9tdEqnm9xHLV97rZ3qr5939_ONov1snUgXZWugKDlBJQgxjnOhRunfpLggKOQfbRc";
    var sessionState = "-39IpPlNJUSqwLo~wCPo.i2gYN_xSbD~"
  
    if (!codeVerifier || !state || !sessionState || !code) {
      return res.status(400).send('You denied the app or your session expired!');
    }
    if (state !== sessionState) {
      return res.status(400).send('Stored tokens didnt match!');
    }
  
    // Obtain access token
    const client = new TwitterApi({ clientId: process.env.TWITTER_CLIENT_ID, clientSecret: process.env.TWITTER_CLIENT_SECRET });
  
    client.loginWithOAuth2({ code, codeVerifier, redirectUri: "http://localhost:3000/auth/twitter/callback" })
      .then(async ({ client: loggedClient, accessToken, refreshToken, expiresIn }) => {
        // {loggedClient} is an authenticated client in behalf of some user
        // Store {accessToken} somewhere, it will be valid until {expiresIn} is hit.
        // If you want to refresh your token later, store {refreshToken} (it is present if 'offline.access' has been given as scope)
        return res.status(200).send(`accessToken: ${accessToken}\nrefreshToken: ${refreshToken}\nexpiresIn: ${expiresIn}`)
        // Example request
        const { data: userObject } = await loggedClient.v2.me();
      })
      .catch(() => res.status(403).send('Invalid verifier or access tokens!'));
  });
  
  app.listen(3000, () => console.log('Running on port 3000'));