/* 旅遊助理：開機。
   有 trips/index.sealed.json（加密的行程清單）→ 解開清單，自動選「正在進行、或最近要出發」的那趟，再解開那趟啟動。
   只有舊的 trip.sealed.json（單趟）→ 照舊解開它。都沒有 → 用 trip.js（示範資料）。
   密碼只在第一次輸入：解出來的金鑰存在這台手機（IndexedDB，不能被匯出），之後打開直接進。所有行程共用同一個密碼。
   加密：PBKDF2-SHA256 由密碼產生金鑰，AES-GCM 解密。放上網的只有密文。 */
(function(){
'use strict';
var app=document.getElementById('app');
function load(src){return new Promise(function(ok,no){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.body.appendChild(s)})}
function run(code){var s=document.createElement('script');s.textContent=code;document.body.appendChild(s)}
function start(){return load('planner.js').then(function(){return load('app.js')})}
function b64(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function getJSON(u){return fetch(u,{cache:'no-cache'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})}

/* ---- 金鑰存在 IndexedDB ---- */
var DB='trip-lock',ST='k';
function idb(){return new Promise(function(ok,no){var r=indexedDB.open(DB,1);r.onupgradeneeded=function(){r.result.createObjectStore(ST)};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})}
function kget(id){return idb().then(function(db){return new Promise(function(ok){var q=db.transaction(ST).objectStore(ST).get(id);q.onsuccess=function(){ok(q.result||null)};q.onerror=function(){ok(null)}})}).catch(function(){return null})}
function kput(id,v){return idb().then(function(db){return new Promise(function(ok){var t=db.transaction(ST,'readwrite');t.objectStore(ST).put(v,id);t.oncomplete=ok;t.onerror=ok})}).catch(function(){})}
function kclear(){return idb().then(function(db){return new Promise(function(ok){var t=db.transaction(ST,'readwrite');t.objectStore(ST).clear();t.oncomplete=ok;t.onerror=ok})}).catch(function(){})}

/* 給 app 用：「鎖起來」忘掉金鑰；trips＝行程清單；current＝現在這趟；pick＝手動換一趟 */
var PICK='trip-pick';
window.TripLock={sealed:false,trips:[],current:'',
  forget:function(){return kclear().then(function(){location.reload()})},
  pick:function(k){try{localStorage.setItem(PICK,JSON.stringify({k:k,on:today()}))}catch(e){}location.reload()}};

function derive(pw,box){var enc=new TextEncoder();
  return crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']).then(function(base){
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(box.salt),iterations:box.iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt'])})}
function open(key,box){return crypto.subtle.decrypt({name:'AES-GCM',iv:b64(box.iv)},key,b64(box.ct)).then(function(buf){return new TextDecoder().decode(buf)})}

/* ---- 輸入密碼的畫面：解得開 box 才算對，對了把金鑰存起來 ---- */
function ask(box,msg){return new Promise(function(done){
  document.body.classList.add('locked');
  app.innerHTML='<form class="lockbox" autocomplete="off"><div class="lock-mark" aria-hidden="true"></div><h1>旅遊助理</h1>'
    +'<p>'+(msg||'輸入行程密碼。這台手機只要輸入一次。')+'</p>'
    +'<input type="password" id="lockpw" autocomplete="current-password" aria-label="行程密碼" enterkeyhint="go">'
    +'<button type="submit">打開</button></form>';
  var f=app.querySelector('form'),pw=app.querySelector('#lockpw'),bt=f.querySelector('button');
  setTimeout(function(){pw.focus()},50);
  f.addEventListener('submit',function(e){e.preventDefault();if(!pw.value)return;
    bt.disabled=true;bt.textContent='解鎖中…';
    derive(pw.value,box).then(function(key){return open(key,box).then(function(txt){return kput(box.salt,key).then(function(){document.body.classList.remove('locked');app.innerHTML='';done({key:key,txt:txt})})})})
      .catch(function(){ask(box,'密碼不對，再試一次。').then(done)})})})}
/* 用記住的金鑰解；沒有或解不開（密碼換了）就問 */
function unlock(box){return kget(box.salt).then(function(key){
  if(!key)return ask(box);
  return open(key,box).then(function(txt){return {key:key,txt:txt}},function(){return kclear().then(function(){return ask(box,'行程更新了，請再輸入一次密碼。')})})})}
function go(code){window.TripLock.sealed=true;run(code);return start()}
function fail(msg){app.innerHTML='<p class="lockbox">'+msg+'</p>'}

/* ---- 選哪一趟：手動選過的優先；但有一趟已經開始、而且是選完之後才開始的，就自動換過去 ---- */
function today(){var d=new Date(),p=function(n){return (n<10?'0':'')+n};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())}
function choose(list){var td=today(),now=list.filter(function(t){return t.start<=td&&td<=t.end}),next=list.filter(function(t){return t.start>td}),
    past=list.filter(function(t){return t.end<td}).sort(function(a,b){return a.end<b.end?1:-1});
  var auto=now[0]||next[0]||past[0],pk=null;try{pk=JSON.parse(localStorage.getItem(PICK)||'null')}catch(e){}
  var mine=pk&&list.filter(function(t){return t.key===pk.k})[0];
  if(mine&&!(now[0]&&now[0].key!==mine.key&&now[0].start>pk.on))return mine;
  return auto}

if(!window.crypto||!crypto.subtle){fail('這個瀏覽器不能解密。請用 Safari 或 Chrome 打開。');return}
getJSON('trips/index.sealed.json').then(function(idx){
  if(idx&&idx.ct)return unlock(idx).then(function(u){
    var list=JSON.parse(u.txt);if(!list.length)return fail('行程清單是空的。');
    var t=choose(list);window.TripLock.trips=list;window.TripLock.current=t.key;
    return getJSON('trips/'+encodeURIComponent(t.key)+'.sealed.json').then(function(box){
      if(!box||!box.ct)return fail('拿不到「'+t.title+'」的資料。連上網路再開一次。');
      return open(u.key,box).then(function(code){
        /* 其他幾趟也先抓一次，存進離線快取，沒網路時也能切換 */
        setTimeout(function(){list.forEach(function(o){if(o.key!==t.key)fetch('trips/'+encodeURIComponent(o.key)+'.sealed.json').catch(function(){})})},4000);
        return go(code)},function(){return fail('「'+t.title+'」的資料解不開，可能是用了不同的密碼加密。')})})});
  /* 舊版：單一個 trip.sealed.json */
  return getJSON('trip.sealed.json').then(function(box){
    if(!box||!box.ct)return load('trip.js').then(start);
    return unlock(box).then(function(u){return go(u.txt)})})});
})();
