import {publicAds} from '../_lib/site-ads.js';
import {json} from '../_lib/google-auth.js';
import {siteSettings} from '../_lib/site-settings.js';
export async function onRequestGet({env}){try{const s=await siteSettings(env);return json({title:s.title,announcement:s.announcement,registrationOpen:!!s.registration_open,downloadsEnabled:!!s.downloads_enabled,ads:await publicAds(env)})}catch{return json({ok:false},503)}}
