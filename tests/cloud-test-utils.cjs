const fs=require('node:fs'),{DatabaseSync}=require('node:sqlite');
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const p of ['0002-contact-auth.sql','0003-password-accounts.sql','0005-site-admin.sql','0004-cloud-sync.sql'])db.exec(fs.readFileSync(require.resolve('../migrations/'+p),'utf8'));
 const binding={prepare(sql){let values=[];const stmt={bind(...v){values=v;return stmt},async first(){return db.prepare(sql).get(...values)||null},async all(){return {results:db.prepare(sql).all(...values)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}}}};return stmt}};
 const objects=new Map(),uploads=new Map();
 const bucket={
  async createMultipartUpload(key){const id=crypto.randomUUID();uploads.set(id,{key,parts:new Map()});return {uploadId:id}},
  resumeMultipartUpload(key,id){return {async uploadPart(n,bytes){const u=uploads.get(id);if(!u||u.key!==key)throw Error('missing upload');const etag=crypto.randomUUID();u.parts.set(n,{etag,bytes:Buffer.from(bytes)});return {partNumber:n,etag}},async complete(parts){const u=uploads.get(id);if(!u)throw Error('no upload');const bytes=Buffer.concat(parts.map((p,i)=>{const part=u.parts.get(p.partNumber);if(part.etag!==p.etag)throw Error('etag');if(i<parts.length-1&&part.bytes.length<5*1024*1024)throw Error('small part');return part.bytes}));objects.set(key,bytes);uploads.delete(id);return {size:bytes.length}},async abort(){uploads.delete(id)}}},
  async head(key){return objects.has(key)?{size:objects.get(key).length}:null},
  async get(key,options){const bytes=objects.get(key);if(!bytes)return null;const b=options?.range?bytes.subarray(options.range.offset,options.range.offset+options.range.length):bytes;return {body:new Blob([b]).stream(),size:bytes.length}},
  async delete(key){objects.delete(key)}
 };
 const env={RAJA_DB:binding,RAJA_MEDIA:bucket,RAJA_SESSION_SECRET:'only-a-test-secret-not-a-real-credential-123456',RAJA_PASSWORD_LOGIN:'true'};
 return {db,env,objects,uploads};
}
async function session(env,id){const {seal}=await import('../functions/_lib/google-auth.js');const now=Math.floor(Date.now()/1000);return 'raja_session='+await seal({iss:'raja-contact',sub:id,email:id+'@example.invalid',name:'Test',iat:now,exp:now+3600},env.RAJA_SESSION_SECRET)}
module.exports={setup,session};
