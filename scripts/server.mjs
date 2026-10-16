import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import app from '../dist/server/index.js';
export function createAppServer(secret){
 const server=createServer(async(req,res)=>{
   try{
    const port=server.address().port,base=`http://127.0.0.1:${port}`;
    const request=new Request(new URL(req.url,base),{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
    const response=await app.fetch(request,{DEMO_SESSION_SECRET:secret});res.statusCode=response.status;
    for(const [key,value] of response.headers)res.setHeader(key,value);
    if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
   }catch{res.statusCode=500;res.end('Local request failed');}
 });return server;
}
