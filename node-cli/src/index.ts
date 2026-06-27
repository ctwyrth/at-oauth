import http from 'node:http';
import { NodeOAuthClient, buildAtprotoLoopbackClientMetadata } from '@atproto/oauth-client-node';
import type { NodeSavedSession, NodeSavedState } from '@atproto/oauth-client-node';
import { Client } from '@atproto/lex';
import open from 'open';
import * as app from './lexicons/app.js';

const stateStore = new Map<string, NodeSavedState>();
const sessionStore = new Map<string, NodeSavedSession>();

const oauthClient = new NodeOAuthClient({
  clientMetadata: buildAtprotoLoopbackClientMetadata({
    scope: 'atproto',
    redirect_uris: ['http://127.0.0.1:3000/callback'],
  }),
  stateStore: {
    async get(key: string) { return stateStore.get(key) },
    async set(key: string, value: NodeSavedState) { stateStore.set(key, value) },
    async del(key: string) { stateStore.delete(key) },
  },
  sessionStore: {
    async get(key: string) { return sessionStore.get(key) },
    async set(key: string, value: NodeSavedSession) { sessionStore.set(key, value) },
    async del(key: string) { sessionStore.delete(key) },
  },
})

async function login(handle: string) {
  // Start OAuth flow - resolve handle, retrieve auth server (PDS), return redirect URL
  const authUrl = await oauthClient.authorize(handle, { scope: 'atproto' });

  // Wait for callback
  const params = await new Promise<URLSearchParams>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, 'http://127.0.0.1:3000');
      if(url.pathname === '/callback') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorized! You can close this tab.</h1>');
        resolve(url.searchParams)
        server.close()
      };
    });
    server.listen(3000, '127.0.0.1', () => {
      console.log('Listning on http://127.0.0.1:3000/callback for OAuth redirect...');
      open(authUrl.toString());
    });
    server.on('error', reject);
  });

  // Exchange the auth for a session
  const { session } = await oauthClient.callback(params);
  return session
}

async function main() {
  const handle = process.argv[2];
  if (!handle) {
    console.error('Usage: npx tsx src/index.ts <your-handle>');
    process.exit(1);
  }

  console.log(`Logging in as ${handle}...`);
  const session = await login(handle);
  console.log(`Logged in! DID: ${session.did}`);

  // Create a Lex client with the authenticated session
  const client = new Client(session);

  // Fetch user's profile
  const profile = await client.get(app.bsky.actor.profile, {
    repo: session.did,
  });

  console.log('\nProfile:');
  console.log(`   Handle: ${handle}`);
  console.log(`   DID: ${session.did}`);
  console.log(`   Display name: ${profile.value?.displayName ?? '(not set)'}`);
  console.log(`   Description: ${profile.value?.description ?? '(not set)'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
})
