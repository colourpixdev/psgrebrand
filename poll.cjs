const https = require('https');
function fetchHtml(){return new Promise(res=>{https.get('https://colourpixdev.github.io/psgrebrand/', resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res(d));}).on('error',()=>res(''))})}
(async()=>{for(let i=0;i<20;i++){const html=await fetchHtml(); if(html && html.includes("VITE_SUPABASE_URL: 'https://")){console.log('Found runtime config on attempt',i); process.exit(0);} else {console.log('Attempt',i,'not updated yet'); await new Promise(r=>setTimeout(r,6000));}} console.log('Timed out waiting for runtime config'); process.exit(2)})()
