import {randomBytes} from 'node:crypto';
import {createAppServer} from './server.mjs';
const secret=process.env.DEMO_SESSION_SECRET||randomBytes(32).toString('base64url');
if(secret.length<43)throw Error('DEMO_SESSION_SECRET needs at least 43 characters.');
createAppServer(secret).listen(8080,'127.0.0.1',()=>console.log('AccessMatrix: http://127.0.0.1:8080 — local demo sessions expire after restart when no persistent key is provided.'));
