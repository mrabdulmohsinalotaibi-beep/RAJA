import {configured,currentUser,json} from '../../_lib/google-auth.js';
export async function onRequestGet({request,env}) {
  return json({configured:configured(env),user:await currentUser(request,env)});
}
