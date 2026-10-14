export function contactConfigured(env){
 return Boolean(env?.RAJA_DB&&env?.TWILIO_ACCOUNT_SID&&env?.TWILIO_AUTH_TOKEN&&/^VA[a-fA-F0-9]{32}$/.test(env?.TWILIO_VERIFY_SERVICE_SID||'')&&String(env?.RAJA_SESSION_SECRET||'').length>=32);
}
export function contactMethods(env){
 const ready=contactConfigured(env);
 return {email:ready&&env.RAJA_EMAIL_LOGIN==='true',sms:ready&&env.RAJA_SMS_LOGIN==='true'};
}
