import { openStore } from '../server/core.mjs';
const [email,role]=process.argv.slice(2);
if(!email||!['user','editor','reviewer','admin'].includes(role)){console.error('Usage: node scripts/role.mjs <registered-email> <user|editor|reviewer|admin>');process.exit(1);}
const store=openStore();const user=store.db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase());
if(!user){console.error('Register this account in AniKind first.');process.exitCode=1;}else{store.db.prepare('UPDATE users SET role=? WHERE id=?').run(role,user.id);store.audit('local-cli','role_change',user.id,{role});console.log(`Role updated: ${role}`);}store.db.close();
