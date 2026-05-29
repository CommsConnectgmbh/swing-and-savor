import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'
const ENV = Object.fromEntries(readFileSync('/Volumes/Code/ClaudeCode/.env.shared','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const pem=readFileSync(ENV.ASC_API_KEY_PATH_SWINGSAVOR,'utf8');const key=await importPKCS8(pem,'ES256')
const t=await new SignJWT({aud:'appstoreconnect-v1'}).setProtectedHeader({alg:'ES256',kid:ENV.ASC_KEY_ID_SWINGSAVOR,typ:'JWT'}).setIssuedAt().setExpirationTime('15m').setIssuer(ENV.ASC_ISSUER_ID_SWINGSAVOR).sign(key)
const fetchJ=async(p)=>{const r=await fetch(`https://api.appstoreconnect.apple.com${p}`,{headers:{Authorization:`Bearer ${t}`}});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);return r.json()}
const v=await fetchJ('/v1/apps/6770264388/appStoreVersions?filter[versionString]=1.1.3')
console.log('Version 1.1.3 State:', v.data[0].attributes.appStoreState)
const subs=await fetchJ('/v1/apps/6770264388/reviewSubmissions?filter[state]=SUBMITTED,WAITING_FOR_REVIEW,IN_REVIEW&limit=5')
for (const s of subs.data) console.log('Submission', s.id.slice(0,8)+'…', 'state:', s.attributes.state, 'submitted:', s.attributes.submittedDate)
