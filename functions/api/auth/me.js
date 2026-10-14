import {passwordConfigured} from '../../_lib/auth-config.js';
import {contactMethods} from '../../_lib/contact-auth.js';
import {configured,googleConfigured,currentUser,json} from '../../_lib/google-auth.js';
export async function onRequestGet({request,env}) {
  return json({configured:configured(env),user:await currentUser(request,env),guestAllowed:true,methods:{password:passwordConfigured(env),google:googleConfigured(env),...contactMethods(env)}});
}
