import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {createProject} from '../../studio/project.js';
import {handleStudio} from '../../server/service.js';
// The service tests run against the committed Drizzle migrations, not a hand-written copy of the schema.
const migrations=new URL('../../hosting/drizzle/',import.meta.url);
export function environment(extra={}){
 const db=new DatabaseSync(':memory:');for(const file of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(new URL(file,migrations),'utf8').split('--> statement-breakpoint'))db.exec(sql);
 const wrap=(sql,args=[])=>({sql,args,bind(...args){return wrap(sql,args)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}}});
 const objects=new Map();return {OPENAI_API_KEY:'test-only',...extra,db,DB:{prepare:sql=>wrap(sql),async batch(items){db.exec('BEGIN');try{const out=items.map(i=>({meta:{changes:db.prepare(i.sql).run(...i.args).changes}}));db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}},BUCKET:{async put(k,v){objects.set(k,v)},async delete(k){objects.delete(k)},async get(k){return objects.has(k)?{json:async()=>JSON.parse(objects.get(k))}:null}}};
}
export const input=(id='message-123')=>({id,message:'Make the background brighter.',scene:'mobile',project:createProject(),history:[],provider:'openai'});
export const req=(path,body,owner='owner')=>new Request('https://studio.test/api/studio/'+path,{method:body?'POST':'GET',headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body?{'Content-Type':'application/json',Origin:'https://studio.test'}:{})},body:body?JSON.stringify(body):undefined});
export const call=(env,path,body,owner)=>handleStudio(req(path,body,owner),env);
export async function collect(res){return (await res.text()).trim().split('\n').map(JSON.parse);}
