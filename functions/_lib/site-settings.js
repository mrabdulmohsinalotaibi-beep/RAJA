export async function siteSettings(env){
 if(!env?.RAJA_DB)return {title:'رَجْع | RAJA',announcement:'',registration_open:1,downloads_enabled:1,version:1};
 const row=await env.RAJA_DB.prepare('SELECT title,announcement,registration_open,downloads_enabled,version,updated_at FROM raja_site_settings WHERE id=1').first();
 if(!row)throw Error('settings-unavailable');return row;
}
