/* 旅遊助理：開機。
   有 trip.sealed.json（加密過的行程）→ 用密碼解開再啟動；沒有 → 用 trip.js（示範資料）。
   密碼只在第一次輸入：解出來的金鑰存在這台手機（IndexedDB，不能被匯出），之後打開直接進。
   加密：PBKDF2-SHA256 由密碼產生金鑰，AES-GCM 解密。放上網的只有密文。 */
(function(){
'use strict';
var app=document.getElementById('app');
function load(src){return new Promise(function(ok,no){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.body.appendChild(s)})}
function run(code){var s=document.createElement('script');s.textContent=code;document.body.appendChild(s)}
function start(){return load('planner.js').then(function(){return load('app.js')})}
function b64(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}

/* ---- 金鑰存在 IndexedDB ---- */
var DB='trip-lock',ST='k';
function idb(){return new Promise(function(ok,no){var r=indexedDB.open(DB,1);r.onupgradeneeded=function(){r.result.createObjectStore(ST)};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})}
function kget(id){return idb().then(function(db){return new Promise(function(ok){var q=db.transaction(ST).objectStore(ST).get(id);q.onsuccess=function(){ok(q.result||null)};q.onerror=function(){ok(null)}})}).catch(function(){return null})}
function kput(id,v){return idb().then(function(db){return new Promise(function(ok){var t=db.transaction(ST,'readwrite');t.objectStore(ST).put(v,id);t.oncomplete=ok;t.onerror=ok})}).catch(function(){})}
function kclear(){return idb().then(function(db){return new Promise(function(ok){var t=db.transaction(ST,'readwrite');t.objectStore(ST).clear();t.oncomplete=ok;t.onerror=ok})}).catch(function(){})}
/* 給 app 的「鎖起來」用：忘掉這台手機上的金鑰 */
window.TripLock={sealed:false,forget:function(){return kclear().then(function(){location.reload()})}};

function derive(pw,box){var enc=new TextEncoder();
  return crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']).then(function(base){
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(box.salt),iterations:box.iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt'])})}
function open(key,box){return crypto.subtle.decrypt({name:'AES-GCM',iv:b64(box.iv)},key,b64(box.ct)).then(function(buf){return new TextDecoder().decode(buf)})}

/* ---- 輸入密碼的畫面 ---- */
function ask(box,msg){
  document.body.classList.add('locked');
  app.innerHTML='<form class="lock" autocomplete="off"><div class="lock-mark" aria-hidden="true"></div><h1>旅遊助理</h1>'
    +'<p>'+(msg||'輸入行程密碼。這台手機只要輸入一次。')+'</p>'
    +'<input type="password" id="lockpw" autocomplete="current-password" aria-label="行程密碼" enterkeyhint="go">'
    +'<button type="submit">打開</button></form>';
  var f=app.querySelector('form'),pw=app.querySelector('#lockpw'),bt=f.querySelector('button');
  setTimeout(function(){pw.focus()},50);
  f.addEventListener('submit',function(e){e.preventDefault();if(!pw.value)return;
    bt.disabled=true;bt.textContent='解鎖中…';
    derive(pw.value,box).then(function(key){return open(key,box).then(function(code){return kput(box.salt,key).then(function(){go(code)})})})
      .catch(function(){ask(box,'密碼不對，再試一次。')})})}
function go(code){document.body.classList.remove('locked');app.innerHTML='';window.TripLock.sealed=true;run(code);start()}

if(!window.crypto||!crypto.subtle){app.innerHTML='<p class="lock">這個瀏覽器不能解密。請用 Safari 或 Chrome 打開。</p>';return}
fetch('trip.sealed.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null}).then(function(box){
  if(!box||!box.ct)return load('trip.js').then(start);
  return kget(box.salt).then(function(key){
    if(!key)return ask(box);
    return open(key,box).then(go,function(){return kclear().then(function(){ask(box,'行程更新了，請再輸入一次密碼。')})})})});
})();
