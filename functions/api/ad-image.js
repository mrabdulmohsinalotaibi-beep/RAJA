export async function onRequestGet({request,env}){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"};
 try{const id=new URL(request.url).searchParams.get('id');if(!id||id.length>60)return new Response(null,{status:404,headers});const row=await env.RAJA_DB.prepare('SELECT image FROM raja_ads WHERE id=? AND enabled=1').bind(id).first();if(!row?.image)return new Response(null,{status:404,headers});const [prefix,base64]=row.image.split(',');headers['Content-Type']=prefix.slice(5).split(';')[0];return new Response(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),{headers})}catch{return new Response(null,{status:503,headers})}
}
