import { createApp } from './app.mjs';
const app=createApp();
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT)||4173;
app.server.listen(port,host,()=>console.log(`AniKind is ready at http://${host}:${port} (${app.config.aiMode === 'demo'?'local template demo':'AI: '+app.config.aiMode})`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
