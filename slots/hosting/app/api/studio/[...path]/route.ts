import {env} from 'cloudflare:workers';
import {handleStudio} from '../../../../server/service.js';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>handleStudio(request,env);
export const POST=(request:Request)=>handleStudio(request,env);
