/* 旅遊助理：程式本體。行程內容全部在 trip.js，這個檔案不用跟著行程改。 */
(function(){
'use strict';
var app=document.getElementById('app'),tabsEl=document.getElementById('tabs'),sheet=document.getElementById('sheet');

/* ---------- 狀態 ---------- */
/* 演練（G7）：出發前在台灣走一遍。選一天，用手機自己的時鐘當那天的時間；進度另外存，結束就丟掉。只在開始的那一天有效 */
var REH=null,RK='reh:'+TRIP.key;
try{REH=JSON.parse(localStorage.getItem(RK)||'null');if(REH&&REH.on!==localYmd()){localStorage.removeItem(RK);localStorage.removeItem(TRIP.key+':reh');REH=null}}catch(e){REH=null}
function localYmd(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
var SK=REH?TRIP.key+':reh':TRIP.key,S={};
try{var raw=localStorage.getItem(SK);if(raw)S=JSON.parse(raw)||{}}catch(e){}
function norm(){['sw','done','drop','ext','cut','pin','here','at','lastT','notes','pv','meet','rt'].forEach(function(k){S[k]=S[k]||{}});
  S.exp=S.exp||[];S.hist=S.hist||[];if(!S.rate)S.rate=TRIP.rate;if(!S.theme)S.theme='glass';
  if(!S.mem||!S.mem.length)S.mem=TRIP.members.map(function(n,k){return {id:'m'+k,n:n,g:0}});
  var byName={};S.mem.forEach(function(x){byName[x.n]=x.id});
  S.exp.forEach(function(e){if(byName[e.payer])e.payer=byName[e.payer];e.among=(e.among||[]).map(function(a){return byName[a]||a})});
  SW.forEach(function(s){if(!(s.k in S.sw))S.sw[s.k]=s.opts[0][0]})}
norm();
function save(){try{localStorage.setItem(SK,JSON.stringify(S))}catch(e){}}

/* ---------- 小工具 ---------- */
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function p2(n){return ('0'+n).slice(-2)}
function ymd(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
function hm(s){var p=s.split(':');return +p[0]*60+ +p[1]}
function fmt(m){m=Math.round(m);return p2(Math.floor(m/60)%24)+':'+p2(m%60)}
function dur(m){m=Math.max(0,Math.round(m));return m<60?m+' 分鐘':Math.floor(m/60)+' 小時'+(m%60?' '+m%60+' 分':'')}
function money(n){return Math.round(n).toLocaleString('en-US')}
function shown(x){if(!x||!x.show)return true;var p=x.show.split('=');return p[1].split('|').indexOf(S.sw[p[0]])>=0}
function navUrl(s){return 'https://www.google.com/maps/dir/?api=1&destination='+(s.ll?s.ll[0]+','+s.ll[1]:encodeURIComponent(s.q||s.t))}
function mapUrl(q){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q)}
var IC={
  now:'<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>',
  plan:'<path d="M7 4v16"/><circle cx="7" cy="6" r="2.2" fill="currentColor"/><circle cx="7" cy="12" r="2.2" fill="currentColor"/><circle cx="7" cy="18" r="2.2" fill="currentColor"/><path d="M12 6h8M12 12h8M12 18h5"/>',
  wallet:'<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  money:'<path d="M6 4l6 8 6-8M12 12v8M8 13h8M8 16.5h8"/>',
  more:'<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  nav:'<path d="M12 3l7 17-7-4-7 4z"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  pin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.500C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.5"/>',
  skip:'<path d="M5 5l8 7-8 7zM17 5v14"/>',chev:'<path d="M9 5l7 7-7 7"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  cloud:'<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.500 4.200 4.200 0 0 0 7 18z"/>',
  rain:'<path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.500 4.200 4.200 0 0 0 7 14z"/><path d="M8 17.500l-1 3M12.500 17.500l-1 3M17 17.500l-1 3"/>',
  snow:'<path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.500 4.200 4.200 0 0 0 7 14z"/><path d="M8 18.500h.01M12 20h.01M16 18.500h.01" stroke-width="3"/>'
};
function ico(n){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[n]+'</svg>'}

/* ---------- 時間：一律用目的地的時間 ---------- */
function there(){var d=new Date();return new Date(d.getTime()+(TRIP.utc*60+d.getTimezoneOffset())*60000)}
function dayDate(i){var p=TRIP.start.split('-');return new Date(+p[0],p[1]-1,+p[2]+i)}
function realIdx(){var t=ymd(there());for(var i=0;i<DAYS.length;i++)if(ymd(dayDate(i))===t)return i;return -1}
function liveIdx(){return REH?REH.i:realIdx()}
function isLive(i){return liveIdx()===i}
function nowMin(i){if(isLive(i)){var d=REH?new Date():there();return d.getHours()*60+d.getMinutes()}
  return S.pv[DK(i)]!=null?S.pv[DK(i)]:hm(DAYS[i].start||'09:30')}
function dlabel(i){var d=dayDate(i);return (d.getMonth()+1)+'/'+d.getDate()}

/* ---------- 重排引擎的接線 ---------- */
/* 行程裡的開關（有人退出、票訂到沒、兩天對調）在這裡套進引擎的資料。切開關會重新載入。 */
function prepDays(){TripPlanner.prepare(DAYS,SW,S.sw)}
prepDays();
/* 3b：Claude 查到、使用者按過「套用」的班次（S.rt[天][起~終]），併進那天的路段。標成推估，畫面會寫「參考」 */
/* D1 搬舊進度：舊版用「第幾天」當 key。用現在的開關狀態把第 i 天對到那天的 id；搬之前整包另存 TRIP.key+':bak'。演練進度直接重來 */
function migrate(){if(S.v>=2)return;
  if(!REH)try{localStorage.setItem(TRIP.key+':bak',JSON.stringify(S))}catch(e){}
  var dk=function(x){return /^\d+$/.test(x)&&DAYS[+x]?DAYS[+x].id:x};
  ['done','drop','ext','cut','pin'].forEach(function(n){var o=S[n]||{},r={};Object.keys(o).forEach(function(k){var m=/^(\d+):(.*)$/.exec(k);if(m){if(!REH)r[dk(m[1])+':'+m[2]]=o[k]}else r[k]=o[k]});S[n]=r});
  ['at','lastT','here','pv','notes','rt'].forEach(function(n){var o=S[n]||{},r={};if(!REH)Object.keys(o).forEach(function(k){r[dk(k)]=o[k]});S[n]=r});
  S.hist=REH?[]:(S.hist||[]).map(function(h){var m=/^(\d+):(.*)$/.exec(h.k||'');return Object.assign({},h,{i:dk(String(h.i)),k:m?dk(m[1])+':'+m[2]:h.k})});
  S.v=2;save()}
migrate();
function applyRt(){Object.keys(S.rt).forEach(function(did){var i=DI(did),D=DAYS[i];if(!D)return;D.legs=D.legs||{};
  Object.keys(S.rt[did]).forEach(function(lg){var ab=lg.split('>');if(!D.places||!D.places[ab[0]]||!D.places[ab[1]])return;var L=D.legs[lg];if(!L)L=D.legs[lg]={name:'Claude 查到的班次',est:true,partial:true,runs:[]};
    var have={};L.runs.forEach(function(r){have[r[0]]=1});S.rt[did][lg].forEach(function(r){if(!have[r[0]])L.runs.push(r)});
    L.runs.sort(function(a,b){return hm(a[0])-hm(b[0])});L.ai=true})})}
applyRt();
var PL=DAYS.map(function(d){return TripPlanner.Planner(d)});
/* D1：進度用每天的 id 記（DK），不再用第幾天；DI 反查那天現在排在第幾天 */
function DK(i){return DAYS[i]?DAYS[i].id:'d'+i}
function DI(id){for(var j=0;j<DAYS.length;j++)if(DAYS[j].id===id)return j;return -1}
function K(i,id){return DK(i)+':'+id}
/* 對調開關（有 days 的）：被對調的兩天都還沒開始（沒有任何紀錄、日期也還沒到）才能切。回傳鎖住的原因；空字串＝可以切 */
/* 這天有沒有紀錄（到了、走了、不去、延長或縮短、試算的時間）。數值歸零的殘留不算 */
function dayRec(id){var pre=id+':',has=function(f,ok){return Object.keys(S[f]||{}).some(function(k){return k.indexOf(pre)===0&&ok(S[f][k])})};
  return has('done',function(v){return v!=null})||has('drop',Boolean)||has('ext',function(v){return v>0})||has('cut',Boolean)||has('pin',function(v){return v!=null})||!!S.here[id]}
/* 清掉某幾天的紀錄（對調前用）：筆記和 Claude 查到的班次留著 */
function clearDays(ids){ids.forEach(function(id){var pre=id+':';['done','drop','ext','cut','pin'].forEach(function(f){Object.keys(S[f]||{}).forEach(function(k){if(k.indexOf(pre)===0)delete S[f][k]})});
  delete S.here[id];delete S.at[id];delete S.lastT[id];delete S.pv[id]});S.hist=S.hist.filter(function(h){return ids.indexOf(h.i)<0})}
function swLock(s){if(!s.days)return '';var td=ymd(there());for(var n=0;n<2;n++){var x=s.days[n],id=DK(x),pre=id+':';
    var rec=dayRec(id);
    if(rec)return '第 '+(x+1)+' 天已經有紀錄，不能再對調';if(REH?REH.i===x:ymd(dayDate(x))<=td)return '第 '+(x+1)+' 天已經開始，不能再對調'}return ''}
function item(i,id){return DAYS[i].items.filter(function(x){return x.id===id})[0]}
/* D2：手機上的修改（蓋過發布的資料，要手動清才會消失）。對不上新資料的也列出來（bad），不靜靜丟掉 */
function mods(){var L=[],dl=function(did){var i=DI(did);return i<0?{i:-1,lab:'找不到這天（'+did+'）'}:{i:i,lab:'第 '+(i+1)+' 天　'+DAYS[i].name}};
  Object.keys(S.rt).forEach(function(did){var d=dl(did);Object.keys(S.rt[did]||{}).forEach(function(lg){var ab=lg.split('>'),P=d.i>=0?DAYS[d.i].places||{}:{},ok=d.i>=0&&P[ab[0]]&&P[ab[1]];
    L.push({f:'rt',k:did+'|'+lg,day:d.lab,i:d.i,bad:!ok,t:(ok?P[ab[0]]+' → '+P[ab[1]]:lg.replace('>',' → '))+'：Claude 查到的班次',v:(S.rt[did][lg]||[]).map(function(r){return r[0]}).join('、')})})});
  var each=function(f,txt){Object.keys(S[f]||{}).forEach(function(k){var v=S[f][k],m=/^(.*?):(.*)$/.exec(k);if(!m)return;
    if(f==='ext'&&!(v>0)||f!=='pin'&&f!=='ext'&&!v||f==='pin'&&v==null)return;var d=dl(m[1]),it=d.i>=0?item(d.i,m[2]):null;
    L.push({f:f,k:k,day:d.lab,i:d.i,bad:!it,t:'「'+(it?it.name:m[2])+'」'+txt(v),v:''})})};
  each('ext',function(v){return '多待 '+v+' 分'});each('cut',function(){return '縮短到最短'});each('drop',function(){return '不去了'});each('pin',function(v){return '打算待到 '+fmt(v)});
  L.sort(function(a,b){return (a.bad-b.bad)||((a.i<0?99:a.i)-(b.i<0?99:b.i))});return L}
function modClear(f,k){if(f==='rt'){var p=k.split('|');if(S.rt[p[0]]){delete S.rt[p[0]][p[1]];if(!Object.keys(S.rt[p[0]]).length)delete S.rt[p[0]]}}else delete S[f][k]}
function pname(i,p){return DAYS[i].places[p]}
function navTo(i,p){return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent((DAYS[i].q&&DAYS[i].q[p])||pname(i,p))}
function transitUrl(i,p){return navTo(i,p)+'&travelmode=transit'}
/* 從存下來的操作，組出「現在的狀態」：在哪、幾點、哪些做完了 */
function mkState(i){var D=DAYS[i],now=nowMin(i),st={at:S.at[DK(i)]||D.startAt,t:now,here:null,arrT:now,done:{},drop:{},cut:{},ext:{},pick:{}};
  D.items.forEach(function(x){var k=K(i,x.id);if(S.done[k]!=null)st.done[x.id]=1;if(S.drop[k])st.drop[x.id]=1;if(S.cut[k])st.cut[x.id]=1;if(S.ext[k])st.ext[x.id]=S.ext[k]});
  var H=S.here[DK(i)];
  if(H&&!st.done[H.id]&&!st.drop[H.id]){st.here=H.id;st.at=item(i,H.id).place;st.arrT=H.t}
  else{/* 還沒按「到了」：照上次出發的時間算路上的計畫（一早還沒按過，就當作照預定時間出門）。到了沒，只有你按了才算 */
    var l0=S.lastT[DK(i)]!=null?S.lastT[DK(i)]:TripPlanner.hm(D.start);if(l0>now)l0=now;st.t=l0}
  st.order=passedOrder(i,st);
  return st}
/* 已經走過頭、又想去的地方（還沒去、加回來）：插在後面還排得進去的位置；哪裡都排不進去就照原順序，畫面會讓你選不去 */
function passedOrder(i,st){var P=PL[i],ids=DAYS[i].items.map(function(x){return x.id}),last=-1;
  ids.forEach(function(id,n){if(st.done[id])last=n});
  var behind=ids.filter(function(id,n){return n<last&&!st.done[id]&&!st.drop[id]&&id!==st.here});
  if(!behind.length)return undefined;
  var order=ids.filter(function(id){return behind.indexOf(id)<0});
  behind.forEach(function(b){var hit=null;
    for(var pos=0;pos<=order.length&&!hit;pos++){var o2=order.slice();o2.splice(pos,0,b);var H=P.hard(st,{order:o2});if(!H.fail&&!H.gap&&!H.lost.some(function(x){return x.id===b}))hit=o2}
    if(hit)order=hit;else order.splice(ids.indexOf(b),0,b)});
  return order}
/* 這一段路「幾點、要在哪裡」：第一個有班次的，沒有就看目的地有沒有時間 */
function target(i,row,now){if(!row)return null;var R=row.ride,walk=0;
  if(R){for(var n=0;n<R.hops.length;n++){var h=R.hops[n];if(now!=null&&h.dep<now&&!h.walk){walk=0;continue}if(h.walk){walk+=h.arr-h.dep;continue}
    return {time:h.dep,what:h.how,where:pname(i,h.from),place:h.from,walk:walk,last:h.last,fixed:h.fixed}}}
  if(row.it.at)return {time:TripPlanner.hm(row.it.at),what:row.it.name,where:pname(i,row.it.place),place:row.it.place,walk:walk,arrive:1};
  return {free:1,walk:walk,arr:row.arr,what:row.it.name,place:row.it.place}}
function hopsTxt(R){return R?R.hops.map(function(h){return h.walk?h.how:fmt(h.dep)+' '+h.how}).join(' → '):''}
var lastRx=[];
/* 整個畫面只認一份「生效中的計畫」：
   預覽中（拖電車）→ 照預覽的時間走；有「待到幾點」→ 照那個時間；都沒有 → 照最近的期限走。
   大字、下一站、路線條、行程頁、去不了的名單，全部從這一份來。 */
function vmOf(i){var P=PL[i],st=mkState(i),now=nowMin(i),m={i:i,st:st,now:now,P:P},pk=st.here?K(i,st.here):null,pin=pk&&S.pin[pk]!=null&&S.pin[pk]>now?S.pin[pk]:null;
  var H=P.hard(st);m.base=H.pl;m.H=H;m.lost=H.lost.slice();m.dls=[];
  if(!H.pl.rows.length&&!H.gap&&!H.fail){m.kind='end';return m}
  if(H.fail){m.kind='conf';m.is=H.fail;m.rx=P.relax(st);lastRx=m.rx;m.pl=H.pl;return m}
  var first=st.here?H.pl.rows[1]:H.pl.rows[0];
  if(H.gap&&!first){m.kind='gap';m.gap=H.gap;m.cur=st.here?H.pl.rows[0]:null;m.pl=H.pl;return m}
  if(st.here){m.kind='here';m.cur=H.pl.rows[0];
    var L=P.limits(st),dl=[];
    L.soft.forEach(function(x){dl.push({t:x.leave,soft:x.it})});if(L.hard)dl.push({t:L.hard.leave,hard:L.hard.why});if(L.gapAt)dl.push({t:L.gapAt.leave,gap:L.gapAt.gap});
    dl=dl.filter(function(x){return x.t>=now}).sort(function(a,b){return a.t-b.t});
    if(pin!=null&&P.hard(st,{leaveAt:pin}).fail)pin=null;m.pin=pin;
    var wiT=i===cur&&whatIf!=null?whatIf:null,lv=wiT!=null?wiT:pin!=null?pin:(dl[0]?dl[0].t:null);
    var E=lv!=null?P.hard(st,{leaveAt:lv}):H;m.E=E;m.pl=E.pl;m.leave=lv;
    E.lost.forEach(function(x){if(!m.lost.some(function(y){return y.id===x.id}))m.lost.push(x)});
    var gone={};m.lost.forEach(function(x){gone[x.id]=1});
    m.dls=dl.filter(function(d){return !(d.soft&&gone[d.soft.id])});
    m.dl=m.dls.filter(function(d){return d.t>=(lv!=null?lv:now)})[0]||null;
    if(wiT!=null)m.wi={t:wiT,bad:!!E.fail,fail:E.fail,newLost:E.lost.filter(function(x){return !H.lost.some(function(y){return y.id===x.id})}),gap:!!E.gap&&!H.gap};
    m.next=E.pl.rows[1]}
  else{m.kind='move';m.pl=H.pl;m.next=H.pl.rows[0]}
  m.tg=target(i,m.next,m.kind==='move'?now:null);return m}
/* 把狀態變成人話：給預設層和詳細層共用 */
function names(a){return a.map(function(x){return x.name}).join('、')}
function say(m){var i=m.i,now=m.now,tg=m.tg,o={st:'go'};
  if(m.kind==='end'){o.lab='今天';o.big='走完了';o.txt=1;o.status='辛苦了';o.frac=1;return o}
  if(m.kind==='conf'){o.st=m.rx.length?'tight':'late';o.lab='趕不上';o.big=m.is.it.name;o.txt=1;o.status=m.is.why;o.frac=.04;return o}
  if(m.kind==='gap'){var g=m.gap;o.st='tight';o.lab='接下來這段要現場查';o.big=pname(i,g.from)+' → '+pname(i,g.it.place);o.txt=1;o.small=1;o.frac=.04;
    o.status=g.missed?g.missed+'的時間過了，其他走法沒有資料':'沒有這段路的完整班次資料';return o}
  if(m.wi){var w=m.wi;o.st=w.bad?'late':(w.newLost.length||w.gap)?'tight':'go';o.lab='如果待到';o.big=fmt(w.t);o.frac=Math.max(.04,(w.t-now)/120);
    o.status=w.bad?'會趕不上 '+w.fail.it.name:w.newLost.length?'會去不了 '+names(w.newLost):w.gap?'之後的路要現場查':(tg&&tg.time!=null&&!tg.arrive?'之後搭 '+fmt(tg.time)+' 的'+tg.what:'後面都來得及');
    o.dstat=w.bad?'趕不上 '+w.fail.it.name.slice(0,5):w.newLost.length?'去不了 '+w.newLost[0].name.slice(0,5):w.gap?'之後要現場查':(tg&&tg.time!=null&&!tg.arrive?'改搭 '+fmt(tg.time):'都來得及');return o}
  /* 下一段是走路（隨時能出發），但後面有期限：大字顯示「最晚幾點走」，不能說不用趕 */
  var dq=m.kind==='here'&&m.pin==null?m.dl:null;
  if((!tg||tg.free)&&dq){var lf=dq.t-now;o.big=fmt(dq.t);o.frac=Math.max(.04,lf/120);o.st=lf<10?'tight':'go';
    o.lab=dq.soft?'想去'+dq.soft.name+'，最晚這時候走':dq.gap?'之後的路要現場查，最晚這時候走':'最晚這時候走';
    o.dlab=dq.soft?'去'+dq.soft.name.slice(0,5)+'最晚走':'最晚走';o.dstat='還有 '+rem(lf);
    o.status=lf>15?'還有 '+dur(lf)+'，可以繼續逛':lf>0?'還有 '+dur(lf)+'，該準備走了':'現在就要走';return o}
  if(!tg||tg.free){
    if(m.kind==='move'&&m.next.arr<=now){o.st='tight';o.lab='應該到「'+m.next.it.name+'」了';o.big=fmt(m.next.arr);o.status='到了請按「到了」';o.dlab='預計到達';o.dstat='到了請按';o.frac=.04}
    else if(m.kind==='move'){o.lab='預計到「'+m.next.it.name+'」';o.big=fmt(m.next.arr);o.status='預計到達（參考）';o.dlab='預計到達';o.dstat='參考';o.frac=Math.max(.04,(m.next.arr-now)/120)}
    else{o.lab='不用趕';o.big='慢慢逛';o.txt=1;o.status='後面沒有要趕的時間';o.frac=1}
    return o}
  var left=tg.time-now,spare=left-(tg.walk||0);o.big=fmt(tg.time);o.frac=left/120;o.st=spare<10?'tight':'go';o.dstat='還有 '+rem(left);
  var d0=m.kind==='here'&&m.pin==null&&!m.wi?m.dl:null;
  o.lab=tg.arrive?tg.what+' 前要到':(d0&&d0.soft?'想去'+d0.soft.name+'，':'')+'在'+tg.where+'搭'+tg.what;
  o.dlab=tg.arrive?'幾點前到':d0&&d0.soft?'去'+d0.soft.name.slice(0,4)+'要搭':d0?'最晚搭':'搭';
  if(m.kind==='here')o.status=spare>15?'還有 '+dur(left)+'，可以繼續逛':spare>0?'還有 '+dur(left)+'，該準備走了':'現在就要走';
  else o.status=left>0?'還有 '+dur(left):'現在';
  if(tg.walk)o.ref='走過去約 '+tg.walk+' 分（參考）';
  if(m.pin!=null)o.ref=(o.ref?o.ref+'　':'')+'你打算 '+fmt(m.pin)+' 走';
  if(m.E&&m.E.gap&&!m.H.gap)o.ref=(o.ref?o.ref+'\n':'')+'之後去「'+m.E.gap.it.name+'」的路要現場查';
  return o}
function applyRx(i,r){Object.keys(r.drop||{}).forEach(function(id){S.drop[K(i,id)]=1});Object.keys(r.cut||{}).forEach(function(id){S.cut[K(i,id)]=1})}
function finish(i,id){var now=nowMin(i);S.hist.push({k:K(i,id),i:DK(i),at:S.at[DK(i)]==null?null:S.at[DK(i)],last:S.lastT[DK(i)]==null?null:S.lastT[DK(i)],here:S.here[DK(i)]||null});if(S.hist.length>60)S.hist.shift();S.done[K(i,id)]=now>1?now:2;S.at[DK(i)]=item(i,id).place;S.lastT[DK(i)]=now;delete S.here[DK(i)];delete S.pin[K(i,id)]}

/* ---------- 定位：只用來顯示離目的地多遠 ---------- */
var pos=null,posMsg='';
function locate(quiet){if(!navigator.geolocation){if(!quiet){posMsg='這台不能定位';render()}return}
  if(!quiet){posMsg='定位中';render()}
  navigator.geolocation.getCurrentPosition(function(p){pos={ll:[p.coords.latitude,p.coords.longitude],t:Date.now()};posMsg='';
      if(!(document.activeElement&&/TEXTAREA|INPUT/.test(document.activeElement.tagName)))render()},
    function(e){if(quiet)return;posMsg=e.code===1?'定位被拒絕':'定位不到';render()},{enableHighAccuracy:true,timeout:12000,maximumAge:30000})}
function autoLocate(){if(REH||liveIdx()<0||document.hidden||!navigator.permissions||!navigator.geolocation)return;
  try{navigator.permissions.query({name:'geolocation'}).then(function(r){if(r.state==='granted')locate(true)},function(){})}catch(e){}}
function dist(a,b){var R=6371000,r=Math.PI/180,d1=(b[0]-a[0])*r,d2=(b[1]-a[1])*r,
  h=Math.sin(d1/2)*Math.sin(d1/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(d2/2)*Math.sin(d2/2);return 2*R*Math.asin(Math.sqrt(h))}
function mtxt(m){return m<1000?Math.round(m/10)*10+' 公尺':(m/1000).toFixed(1)+' 公里'}
function farTxt(i,p){var ll=DAYS[i].ll2&&DAYS[i].ll2[p];if(!pos||!ll||Date.now()-pos.t>600000)return '';return mtxt(dist(pos.ll,ll))}

/* ---------- 天氣（Open-Meteo，免金鑰） ---------- */
var WX={};
function wx(i){var D=DAYS[i];if(!D.ll)return null;var date=ymd(dayDate(i)),k=date,diff=Math.round((dayDate(i)-new Date(ymd(there())+'T00:00'))/86400000);
  if(diff<0||diff>15)return {far:1};
  if(WX[k])return WX[k];
  WX[k]={loading:1};
  var u='https://api.open-meteo.com/v1/forecast?latitude='+D.ll[0]+'&longitude='+D.ll[1]+'&hourly=temperature_2m,precipitation_probability,weather_code,cloud_cover,precipitation,wind_speed_10m&timezone=auto&start_date='+date+'&end_date='+date;
  fetch(u).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){var h={},H=j.hourly;
    H.time.forEach(function(t,n){h[+t.slice(11,13)]={c:H.temperature_2m[n],p:H.precipitation_probability[n],w:H.weather_code[n],cc:(H.cloud_cover||[])[n],pr:(H.precipitation||[])[n],ws:(H.wind_speed_10m||[])[n]}});
    WX[k]={h:h};render()}).catch(function(){WX[k]={err:1};render()});
  return WX[k]}
function wicon(w){return w>=71&&w<=77||w===85||w===86?'snow':w>=51?'rain':w>=1?'cloud':'sun'}
function popAt(i,m){var w=WX[ymd(dayDate(i))];if(!w||!w.h||m==null)return null;var h=w.h[Math.floor(m/60)%24];return h?h.p:null}
function wxStrip(i,t0){var w=wx(i);if(!w)return '';
  if(w.far)return '<div class="sub">天氣預報在出發前兩週內才會出現。</div>';
  if(w.loading)return '<div class="sub">讀取天氣中…</div>';
  if(w.err)return '<div class="sub">現在抓不到天氣預報。</div>';
  var h0=Math.max(6,Math.floor(t0/60)),out='';
  for(var h=h0,c=0;h<=23&&c<6;h+=2,c++){var x=w.h[h];if(!x)continue;
    out+='<div class="'+(x.p>=60?'wet':'')+'"><span class="h">'+p2(h)+':00</span>'+ico(wicon(x.w))+'<span class="c">'+Math.round(x.c)+'°</span><br><span class="p">'+(x.p==null?'':x.p+'%')+'</span></div>'}
  return '<div class="wx" aria-label="今天天氣，每格是溫度和降雨機率">'+out+'</div>'}

/* ---------- 分帳：成員可以改名、可以分組（同一組算一個單位結清） ---------- */
function mem(id){for(var n=0;n<S.mem.length;n++)if(S.mem[n].id===id)return S.mem[n];return {id:id,n:'?',g:0}}
function unitOf(id){var x=mem(id);return x.g?'g'+x.g:id}
function unitName(u){if(u.charAt(0)!=='g')return mem(u).n;var g=+u.slice(1);return S.mem.filter(function(x){return x.g===g}).map(function(x){return x.n}).join('＋')}
function settle(){var bal={};S.mem.forEach(function(x){bal[unitOf(x.id)]=0});
  S.exp.forEach(function(e){var a=e.among&&e.among.length?e.among:S.mem.map(function(x){return x.id}),sh=e.amt/a.length;
    bal[unitOf(e.payer)]=(bal[unitOf(e.payer)]||0)+e.amt;a.forEach(function(id){bal[unitOf(id)]=(bal[unitOf(id)]||0)-sh})});
  var P=[],N=[],out=[];Object.keys(bal).forEach(function(u){if(bal[u]>0.5)P.push([u,bal[u]]);else if(bal[u]<-0.5)N.push([u,-bal[u]])});
  P.sort(function(a,b){return b[1]-a[1]});N.sort(function(a,b){return b[1]-a[1]});
  var a=0,b=0;while(a<N.length&&b<P.length){var v=Math.min(N[a][1],P[b][1]);out.push([unitName(N[a][0]),unitName(P[b][0]),v]);N[a][1]-=v;P[b][1]-=v;if(N[a][1]<0.5)a++;if(P[b][1]<0.5)b++}
  return out}
function memUsed(id){return S.exp.some(function(e){return e.payer===id||(e.among||[]).indexOf(id)>=0})}
/* ---------- 畫面 ---------- */
var tab='now',sub=null,cur=Math.max(0,liveIdx()),sosOpen=-1,sh=null,lastFrac=1;
var G=null; /* 團員模式：網址帶 #g= */
function readHash(){G=null;var m=/^#g=(.+)$/.exec(location.hash);if(!m)return;
  try{G=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));if(G.d>=0&&G.d<DAYS.length)cur=G.d}catch(e){G=null}}
readHash();
/* 3b：Claude 回答最後附的回傳連結 #r=<行程代號>/<第幾天>/<起>~<終>:0930-1005,1010-1045;<起>~<終>:… */
var RT=null;
function readRt(){RT=null;var m=/^#r=(.+)$/.exec(location.hash);if(m)parseRt(m[1])}
/* 從一段文字裡找出 #r=…（貼上 Claude 的整段回答也行）。iPhone 上點連結回不到主畫面 app，所以主要靠複製貼上 */
function rtFrom(txt){var m=/#r=([^\s<>"'）)】」]+)/.exec(txt||'');return m?m[1]:null}
function parseRt(raw){RT=null;try{raw=decodeURIComponent(raw)}catch(e){}raw=raw.replace(/[。.，,]+$/,'');
  var p=raw.split('/'),key=p[0],d=+p[1]-1,legs={},bad=[];
  if(p.length<3||!(d>=0)){RT={err:'連結的格式不對，請 Claude 照 app 給的格式重寫一次。'};return}
  if(key!==TRIP.key){var o=(window.TripLock&&TripLock.trips||[]).filter(function(t){return t.key===key})[0];RT={err:'這個連結是'+(o?'「'+o.title+'」':'另一趟行程')+'的，現在開的是「'+TRIP.title+'」。',other:o&&o.key};return}
  if(d>=DAYS.length){RT={err:'這趟沒有第 '+(d+1)+' 天。'};return}
  var PS=DAYS[d].places||{},t4=function(x){return /^\d{4}$/.test(x)&&+x.slice(0,2)<30&&+x.slice(2)<60?x.slice(0,2)+':'+x.slice(2):null};
  p.slice(2).join('/').split(';').forEach(function(seg){seg=seg.trim();if(!seg)return;var q=/^([A-Za-z0-9_]+)~([A-Za-z0-9_]+):(.+)$/.exec(seg);
    if(!q||!PS[q[1]]||!PS[q[2]]){bad.push(seg);return}
    var runs=q[3].split(',').map(function(r){var t=r.trim().split('-');var a=t4(t[0]),b=t4(t[1]||'');return a&&b?[a,b,'Claude 查到']:null});
    if(runs.some(function(r){return !r})){bad.push(seg);return}
    legs[q[1]+'>'+q[2]]=(legs[q[1]+'>'+q[2]]||[]).concat(runs)});
  if(!Object.keys(legs).length){RT={err:'連結裡沒有看得懂的班次'+(bad.length?'：'+bad.join('；'):'')+'。'};return}
  RT={d:d,legs:legs,bad:bad};cur=d}
function clearHash(){history.replaceState(null,'',location.pathname+location.search)}
readRt();if(RT)sh={t:'rt'};
IC.x='<path d="M6 6l12 12M18 6L6 18"/>';
IC.train='<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.500-4M15 21l-1.500-4"/><circle cx="9" cy="14" r=".6" fill="currentColor"/><circle cx="15" cy="14" r=".6" fill="currentColor"/>';
IC.walk='<circle cx="13" cy="4.500" r="1.800"/><path d="M9 21l2-6-2-3 1-4 3 1 2 3 3 1M11 15l3 2 1 4"/>';
IC.lock='<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
IC.undo='<path d="M4 9h10a5 5 0 0 1 0 10h-3"/><path d="M8 5L4 9l4 4"/>';IC.desk='<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>';
IC.note='<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6"/>';IC.alt='<path d="M4 7h9a4 4 0 0 1 4 4v9"/><path d="M4 7l4-4M4 7l4 4M4 17h5"/>';
IC.layers='<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>';IC.chat='<path d="M5 5h14v10H9l-4 4z"/>';
IC.sos='<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.500v.01"/>';IC.people='<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.300 2.700-6 6-6s6 2.700 6 6"/><circle cx="17" cy="9" r="2.300"/><path d="M15.500 14.200c3 .2 5.500 2.600 5.500 5.800"/>';
function rem(m){m=Math.max(0,Math.round(m));return m<60?m+' 分':Math.floor(m/60)+':'+p2(m%60)}
function vib(p){try{if(navigator.vibrate)navigator.vibrate(p||8)}catch(e){}}
function go(t,s){whatIf=null;chg=null;if(t==='plan'&&tab!=='plan')planAnim=true;tab=t;sub=s||null;sh=null;paint();scrollTo(0,0)}
function kindTxt(it){return it.kind==='wall'?'要準時到':it.kind==='must'?'一定要去':'有空再去'}
function wxNow(i,t0){var x;if((!isLive(i)||REH)&&S.dwx){var dv=DWXV[S.dwx];x={c:dv.c,p:dv.p,w:dv.code}}else{var w=wx(i);if(!w||!w.h)return '';x=w.h[Math.floor(t0/60)%24]}if(!x)return '';
  return '<button class="wxb'+(x.p>=60?' wet':'')+'" data-sheet="wx" aria-label="天氣 '+Math.round(x.c)+' 度，降雨機率 '+x.p+'%">'+ico(wicon(x.w))+'<b>'+Math.round(x.c)+'°</b>'+(x.p>=30?'<i>'+x.p+'%</i>':'')+'</button>'}
var DWX=[['','實際'],['clear','晴'],['cloud','多雲'],['rain','雨'],['snow','雪'],['fog','霧'],['storm','雷雨']];
var DWXV={clear:{cc:5,pr:0,code:0,ws:6,c:22,p:0},cloud:{cc:80,pr:0,code:3,ws:14,c:19,p:20},rain:{cc:96,pr:3,code:63,ws:22,c:15,p:90},snow:{cc:92,pr:1.2,code:73,ws:6,c:-1,p:80},fog:{cc:65,pr:0,code:45,ws:2,c:12,p:10},storm:{cc:100,pr:8,code:95,ws:38,c:18,p:95}};
function pvBar(t0){var dw=S.dwx||'',lab=DWX.filter(function(x){return x[0]===dw})[0][1];
  if(REH&&cur===REH.i)return '<div class="pvrow"><button class="pv reh" data-sub="reh" aria-label="演練中，點這裡結束"><span>演練中</span><b>第 '+(REH.i+1)+' 天　'+fmt(t0)+'</b></button>'
   +(S.theme==='glass'?'<button class="pvw" data-dwx="1" aria-label="示範天氣：'+lab+'">'+lab+'</button>':'')+'</div>';
  if(isLive(cur))return '';
  return '<div class="pvrow"><label class="pv"><span>示範時間</span><input type="range" id="pv" min="0" max="1435" step="5" value="'+t0+'" style="--pvp:'+(t0/14.35).toFixed(1)+'%" aria-label="示範時間"><b id="pvv">'+fmt(t0)+'</b></label>'
   +(S.theme==='glass'?'<button class="pvw" data-dwx="1" aria-label="示範天氣：'+lab+'">'+lab+'</button>':'')+'</div>'}
/* 天空要用的天氣：示範模式可以手動選；否則用預報 */
function skyWx(i,t0){if((!isLive(i)||REH)&&S.dwx)return DWXV[S.dwx];var w=WX[ymd(dayDate(i))];if(!w||!w.h)return null;var h=w.h[Math.floor(t0/60)%24];
  return h?{cc:h.cc==null?(h.w>=3?80:h.w>=1?40:5):h.cc,pr:h.pr||0,code:h.w||0,ws:h.ws||0}:null}
function skyAt(i,t0){var d=dayDate(i);return new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),0,t0)-TRIP.utc*3600000)}
function head(m){var i=m.i,D=DAYS[i],where=m.st.here?'在 '+item(i,m.st.here).name:m.kind==='move'?'往 '+m.next.it.name:m.kind==='gap'?'往 '+m.gap.it.name:m.kind==='conf'?'往 '+m.is.it.name:D.name;
  return '<header class="hd"><div><b>'+esc(where)+'</b><span>'+esc(D.name)+'　'+dlabel(i)+'</span></div>'+wxNow(i,m.now)
   +'</header>'+pvBar(m.now)}
var lastBig='',noRoll=false;
function roll(str){return '<span class="sr">'+str+'</span><span class="roll num" aria-hidden="true" data-s="'+str+'">'+str.split('').map(function(ch,n){if(!/\d/.test(ch))return '<span class="cl">'+ch+'</span>';
  var pv=noRoll?+ch:/\d/.test(lastBig.charAt(n))?+lastBig.charAt(n):(+ch+9)%10;
  return '<span class="dg"><i style="transform:translateY(-'+pv+'em)" data-to="'+ch+'">0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9</i></span>'}).join('')+'</span>'}
function bigOf(o){return o.txt?'<b class="txt'+(o.small?' sm':'')+'">'+esc(o.big)+'</b>':roll(o.big)}
function dial(frac,lab,big,subt){var R=112,C=2*Math.PI*R,f=Math.max(0,Math.min(1,frac)),tk='';
  for(var n=0;n<60;n++)tk+='<line class="tk'+(n/60<f?' on':'')+'" x1="130" y1="'+(n%5?4:1)+'" x2="130" y2="9" transform="rotate('+n*6+' 130 130)"/>';
  return '<div class="dial"><svg viewBox="0 0 260 260" aria-hidden="true"><defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--c2)"/><stop offset="1" style="stop-color:var(--c)"/></linearGradient></defs>'
   +'<g class="tks">'+tk+'</g><circle class="trk" cx="130" cy="130" r="'+R+'"/>'
   +'<circle class="arc" id="arc" cx="130" cy="130" r="'+R+'" transform="rotate(-90 130 130)" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+(C*(1-lastFrac)).toFixed(1)+'" data-to="'+(C*(1-f)).toFixed(1)+'" data-f="'+f+'"/>'
   +'<g class="hdot" id="hdot" style="transform:rotate('+(lastFrac*360).toFixed(1)+'deg)" data-to="'+(f*360).toFixed(1)+'"><circle cx="130" cy="'+(130-R)+'" r="7"/></g></svg>'
   +'<div class="in"><span class="lab">'+lab+'</span><span class="big">'+big+'</span><span class="rem">'+(subt||'&nbsp;')+'</span></div><span class="rip"></span></div>'}

/* ---------- 現在 ---------- */
var whatIf=null,wdrag=null,win=null;
/* 路線條：照時間比例畫。電車是現在，往右拖 = 待久一點 */
function winOf(m){if(wdrag&&win)return win;
  /* 在路上：從出發的時間畫起，已經過去的站不會全擠在最左邊 */
  if(m.kind==='move'){var a0=Math.min(m.now,m.st.t);win={a:a0,b:Math.min(a0+600,Math.max(a0+180,m.now+60))};return win}
  var far=m.kind==='here'&&m.dls.length?m.dls[m.dls.length-1].t:null,span=far!=null?Math.max(120,(far-m.now)*1.6):180;win={a:m.now,b:m.now+Math.min(span,480)};return win}
function tX(w,t){return 24+Math.max(0,Math.min(1,(t-w.a)/(w.b-w.a)))*312}
function strip(m){var w=winOf(m),pl=m.pl,s='',all=pl.rows.slice(m.st.here?1:0),nx=m.next,rows=all.filter(function(r){return r.arr<=w.b}),bad={};
  if(rows.length<all.length)rows.push(all[rows.length]);
  if(m.wi&&m.wi.bad)bad[m.wi.fail.it.id]=1;
  var R0=tX(w,m.now).toFixed(1);
  s+=(+R0>26?'<line x1="24" y1="52" x2="'+R0+'" y2="52" class="spast"/>':'')+'<line x1="'+R0+'" y1="52" x2="336" y2="52" class="srail"/><line x1="'+(+R0+2)+'" y1="55.5" x2="334" y2="55.5" class="srail2"/>';
  /* 期限：同一時間或太近的合併成一個標記 */
  var grp=[];(m.kind==='here'?m.dls:[]).forEach(function(d){var x=tX(w,d.t),g=grp[grp.length-1];if(g&&x-g.x<58)g.items.push(d);else grp.push({x:x,t:d.t,items:[d]})});
  grp.forEach(function(g){var x=g.x.toFixed(1),soft=g.items.filter(function(d){return d.soft}),hard=g.items.some(function(d){return d.hard}),gap=g.items.some(function(d){return d.gap});
    var lab=hard?'最晚':gap?'最後一班':soft.length>1?soft[0].soft.name.slice(0,3)+'等':soft[0].soft.name.slice(0,4);
    s+='<g class="slim'+(hard||gap?'':' soft')+'"><line x1="'+x+'" y1="38" x2="'+x+'" y2="86"/><text x="'+x+'" y="101" class="stm dl">'+esc(lab)+' '+fmt(g.t)+'</text></g>'});
  /* 各站：名稱放在線上方；跟前一站太近就改放下方 */
  var lastX=-99,up=true;
  rows.forEach(function(r){var x=tX(w,r.arr),b=bad[r.it.id],it=r.it;up=x-lastX<44?!up:true;lastX=x;
    s+='<circle cx="'+x.toFixed(1)+'" cy="52" r="7" class="sst '+(b?'bad':it.kind==='wall'?'core':it.kind==='soft'?'soft':'')+'"/>'
     +'<text x="'+x.toFixed(1)+'" y="'+(up?30:80)+'" class="snm'+(b?' bad':'')+'">'+esc(it.name.slice(0,5))+'</text><text x="'+x.toFixed(1)+'" y="'+(up?15:94)+'" class="stm'+(b?' bad':'')+'">'+fmt(r.arr)+'</text>'});
  var t=m.wi?m.wi.t:(m.pin!=null?m.pin:m.now),X=tX(w,t),X0=tX(w,m.now);
  if(t>m.now)s+='<line x1="'+X0.toFixed(1)+'" y1="52" x2="'+X.toFixed(1)+'" y2="52" class="strail"/>';
  var cls=m.wi?(m.wi.bad?' bad':(m.wi.newLost.length||m.wi.gap)?' warn':''):'';
  /* 「我」：疊在路線條上的 HTML 玻璃泡（跟分頁列選中的那顆、示範時間圓鈕同一個樣式）；拖動時放大成透明放大鏡 */
  var lp=(X/3.6).toFixed(2)+'%',me='<div class="me'+cls+(wdrag?' grab':'')+(m.kind==='here'?'':' fixed')+'" style="left:'+lp+'"><i class="me-t"><i'+(t>m.now?' class="on"':'')+'></i></i></div>'
   +(m.kind==='here'?'<span class="me-l'+cls+'" style="left:'+lp+'">'+(m.wi?'待到 '+fmt(m.wi.t):m.pin!=null?'打算 '+fmt(m.pin):'現在')+'</span>':'');
  return '<div class="strip">'+(nx?'<div class="sh"><span>下一站</span><b>'+esc(nx.it.name)+'</b><i class="num">'+fmt(nx.arr)+'</i></div>':'')+'<div class="lw'+(m.kind==='here'?'':' off')+'"><svg class="lline'+(m.kind==='here'?'':' off')+'" viewBox="0 0 360 108"'+(m.kind==='here'?' aria-label="拖動，試算待到幾點"':'')+'><defs><radialGradient id="kgl" cx=".35" cy=".25" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" stop-color="#fff" stop-opacity=".35"/><stop offset=".7" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></radialGradient></defs>'+s+'</svg>'+me+'</div></div>'}
/* 選項：趕不上、沒有資料時給的按鈕 */
function lastItem(i){var it=DAYS[i].items;return it[it.length-1]}
function skipBtn(i,it){return it&&it.id!==lastItem(i).id?'<button class="opt ghost" data-skipit="'+it.id+'">不去「'+esc(it.name)+'」了</button>':''}
function fixOpts(m){var i=m.i,h='';
  if(m.kind==='conf'){h=m.rx.length?m.rx.slice(0,3).map(function(o,n){return '<button class="opt" data-rx="'+n+'">'+esc(o.say)+'</button>'}).join('')
      :(m.rx.fail||[]).map(function(f){return '<p class="gapp">'+esc(f)+'</p>'}).join('')+(m.is.it.fallback?'<p class="gapp">備案：'+esc(m.is.it.fallback)+'</p>':'')+skipBtn(i,m.is.it)+askBtn('這個情況我該怎麼辦？請查現在的班次。',null,'問 Claude')}
  else if(m.kind==='gap'){var g=m.gap;h=(g.it.fallback?'<p class="gapp">備案：'+esc(g.it.fallback)+'</p>':'')+skipBtn(i,g.it)
      +askBtn('我要從'+pname(i,g.from)+'去'+pname(i,g.it.place)+'，請查現在最近的班次和走法。',[g.from,g.it.place],'問 Claude 查班次')
      +'<a class="opt ghost" href="'+transitUrl(i,g.it.place)+'" target="_blank" rel="noopener">用 Google Maps 查路線</a>'}
  return h?'<div class="opts">'+h+'</div>':''}
function lostLine(m){return m.lost.length&&!m.wi?'<div class="ref lost">'+ico('skip')+'去不了了：'+esc(names(m.lost))+'</div>':''}
/* 主按鈕：在景點是「走了」；在路上是「怎麼去」。到了不用按，app 自己推算 */
function mainBtn(m){if(m.wi&&!wdrag)return '<button class="gb2" data-wi="no">'+ico('undo')+'取消</button>'+(m.wi.bad?'':'<button class="pb" data-wi="ok">'+ico('check')+'待到 '+fmt(m.wi.t)+'</button>');
  if(wdrag)return '';
  if(m.st.here)return '<button class="pb" data-done="'+m.st.here+'">'+ico('check')+'走了</button>';
  if(m.kind==='move'&&m.next)return '<button class="pb" data-arrive="'+m.next.it.id+'">'+ico('pin')+'到了</button>';
  if(m.kind==='gap'||m.kind==='conf'){var t=m.kind==='gap'?m.gap.it:m.is.it;return '<button class="pb" data-arrive="'+t.id+'">'+ico('pin')+'到了</button>'}
  return ''}
function vNow(){var m=vmOf(cur),o=say(m),tg=m.tg,body=dial(o.frac,esc(o.dlab||o.lab),bigOf(o),esc(o.dstat||o.status)),how='';
  if(m.kind==='conf'||m.kind==='gap')body='<div class="alert"><span class="lab">'+esc(o.lab)+'</span><b>'+esc(o.big)+'</b><span class="why">'+esc(o.status)+'</span>'+(m.lost.length?'<span class="why">去不了了：'+esc(names(m.lost))+'</span>':'')+'</div>'+fixOpts(m);
  else if(!m.wi&&m.next&&m.next.ride&&m.next.arr>m.now){
    /* 「怎麼去」就是圓環下面這一條：寫著要在哪裡搭什麼，點了看每一段和導航 */
    how=tg&&!tg.free&&!tg.arrive?ico(tg.fixed?'lock':'train')+esc(tg.what)+'　在'+esc(tg.where)+'搭':ico('walk')+'怎麼去「'+esc(m.next.it.name)+'」';
    body+='<button class="bind" data-sheet="route">'+how+ico('chev')+'</button>'}
  if(!m.wi&&m.kind!=='conf'&&m.kind!=='gap'&&o.ref)body+='<div class="ref">'+esc(o.ref)+'</div>';
  var btn=mainBtn(m),acts=btn?'<div class="acts">'+btn+'</div>':'';
  var extra=(m.kind==='here'||m.kind==='move')&&!m.wi?lostLine(m):'';
  if(m.kind==='here'||m.kind==='move')extra+=strip(m);
  var ask=m.wi||wdrag?'':'<button class="askbar" data-sheet="change">'+ico('chat')+'<span>計畫有變？</span>'+ico('chev')+'</button>';
  return '<section class="stage one '+o.st+'">'+head(m)+body+acts+extra+ask+'</section>'}

/* ---------- 行程 ---------- */
function hopsTxt(R){return R?R.hops.map(function(h){return h.walk?h.how:fmt(h.dep)+' '+h.how}).join(' → '):''}
function vPlan(){var i=cur,D=DAYS[i],m=vmOf(i),rows={},pl=m.pl||m.base;pl.rows.forEach(function(r){rows[r.it.id]=r});var curId=m.st.here||(m.next&&m.next.it.id);
  var gone={};m.lost.forEach(function(x){gone[x.id]=1});
  var list=D.items.map(function(it){var k=K(i,it.id),dn=S.done[k]!=null,lo=!!gone[it.id],dr=!!S.drop[k]||lo,r=rows[it.id],tm='',via='';
    if(dn)tm=ico('check');else if(!dr&&it.at)tm='<b class="hard">'+it.at+'</b>';else if(!dr&&r)tm='<b>'+fmt(it.id===m.st.here?m.st.arrT:r.arr)+'</b>';
    if(!dn&&!dr&&r&&r.ride)via='<i class="via">'+esc(hopsTxt(r.ride))+'</i>';
    return '<button class="stop'+(it.kind==='wall'?' core':'')+(it.kind==='soft'?' optl':'')+(dn?' done':'')+(dr?' skip':'')+(curId===it.id?' next':'')+'" data-sheet="stop" data-id="'+it.id+'"><span class="tcol num">'+tm+'</span><span class="rail"><span class="dot"></span></span><span class="body"><span class="bw"><b>'+esc(it.name)+'</b>'+via+'</span>'+(it.kind==='wall'&&!dn?'<i class="tg s">要準時</i>':lo?'<i class="tg w">去不了</i>':S.drop[k]?'<i class="tg">不去了</i>':'')+'</span></button>'}).join('');
  return '<header class="hd"><div><b>行程</b><span>'+esc(D.name)+'　'+dlabel(i)+'</span></div></header>'
   +(DAYS.length>1?'<div class="days">'+DAYS.map(function(d,n){return '<button data-day="'+n+'" class="'+(n===cur?'on':'')+'"><b>'+dlabel(n)+'</b><span>'+esc(d.name)+'</span></button>'}).join('')+'</div>':'')
   +pvBar(m.now)+'<div class="panel lmp"><div class="linemap">'+list+'</div></div>'
   +(pl.unknown?'<p class="sub">「'+esc(pl.unknown.it.name)+'」之後要現場查：'+esc(pname(i,pl.unknown.from))+' → '+esc(pname(i,pl.unknown.it.place))+' 沒有資料。</p>':'')
   +'<div class="two"><button class="gb" data-sheet="miss">'+ico('alt')+'備案</button><button class="gb" data-sheet="note">'+ico('note')+'筆記</button></div>'}

/* ---------- 更多：票夾、錢、出事了、傳給團員 ---------- */
function hotelTicket(k,tonight){var h=HOTELS[k];if(!h)return '';
  return '<div class="ticket"><div class="main"><div class="k">'+(tonight?'今晚':'住宿')+'　'+esc(h.ci)+'</div><div class="t">'+esc(h.jp)+'</div>'
   +h.codes.filter(shown).map(function(c){return '<div class="code">'+esc(c.c)+'</div><div class="d">'+esc(c.d)+'</div>'}).join('')
   +'</div><div class="stub"><button class="rb" data-desk="'+k+'" aria-label="給櫃檯看">'+ico('desk')+'</button><a class="rb" href="'+navUrl({ll:h.ll,q:h.jp})+'" target="_blank" rel="noopener" aria-label="導航">'+ico('nav')+'</a></div></div>'}
function backBtn(){return '<button class="back" data-sub="" aria-label="回到更多">'+ico('undo')+'</button>'}
function vWallet(){var k0=DAYS[cur].hotel,h='<header class="hd">'+backBtn()+'<div><b>票夾</b></div></header>';
  if(k0)h+=hotelTicket(k0,true);
  Object.keys(HOTELS).forEach(function(k){if(k!==k0)h+=hotelTicket(k,false)});
  return h+DOCS.filter(shown).map(function(t){return '<div class="ticket"><div class="main"><div class="k">'+esc(t.k||'')+'</div><div class="t">'+esc(t.t)+'</div>'+(t.code?'<div class="code">'+esc(t.code)+'</div>':'')+'<div class="d">'+esc(t.d)+'</div></div></div>'}).join('')}
function vMoney(){var tot=S.exp.reduce(function(a,e){return a+e.amt},0),st=settle();
  return '<header class="hd">'+backBtn()+'<div><b>錢</b></div><button class="ib" data-sheet="members" aria-label="成員和分組">'+ico('people')+'</button><button class="ib" data-sheet="rate" aria-label="匯率">'+ico('more')+'</button></header>'
   +'<div class="calc"><input type="number" id="ea" inputmode="decimal" placeholder="0" aria-label="金額 '+TRIP.cur+'"><span class="cur">'+TRIP.cur+'</span><span class="eq num" id="cvo">≈ 0 '+TRIP.home+'</span></div>'
   +'<div class="panel"><input type="text" id="en" placeholder="買什麼" aria-label="項目" class="wide">'
   +'<div class="lbl">誰付</div><div class="chips" id="epc">'+S.mem.map(function(x,n){return '<button class="chip'+(n===0?' on':'')+'" data-payer="'+x.id+'" aria-pressed="'+(n===0)+'">'+esc(x.n)+'</button>'}).join('')+'</div>'
   +'<div class="lbl">誰分</div><div class="chips" id="eam">'+S.mem.map(function(x){return '<button class="chip on" data-am="'+x.id+'" aria-pressed="true">'+esc(x.n)+'</button>'}).join('')+'</div>'
   +'<button class="pb wide" data-addexp="1">'+ico('plus')+'記下</button><div class="sub" id="em"></div></div>'
   +(st.length?'<h2>結清</h2><div class="panel">'+st.map(function(x){return '<div class="item"><span>'+esc(x[0])+' → '+esc(x[1])+'</span><span class="amt">'+money(x[2])+'</span></div>'}).join('')+'</div>':'')
   +(S.exp.length?'<h2>明細　<span class="sub num">'+money(tot)+' '+TRIP.cur+'</span></h2><div class="panel">'+S.exp.slice().reverse().map(function(e){var am=e.among||[];return '<div class="item"><span>'+esc(e.note||'沒寫項目')+'<small>'+esc(mem(e.payer).n)+' 付　'+(am.length===S.mem.length?'全員':esc(am.map(function(id){return mem(id).n}).join(' ')))+'</small></span><span><span class="amt">'+money(e.amt)+'</span><button class="ib sm" data-delexp="'+e.id+'" aria-label="刪除">'+ico('x')+'</button></span></div>'}).join('')+'</div>':'')}
function shareUrl(){var o={d:cur,t:S.meet.time||'',p:S.meet.place||''};
  return location.href.split('#')[0]+'#g='+encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(o)))))}
function groupText(){var D=DAYS[cur],m=S.meet,L=['【'+dlabel(cur)+' '+D.name+'】'];
  if(m.time||m.place)L.push('集合 '+(m.time||'')+' '+(m.place||''));L.push(shareUrl());return L.join('\n')}
function askText(q,ex){var st=mkState(cur),txt=PL[cur].brief(st),PS=DAYS[cur].places||{},ks=Object.keys(PS);
  ex=ex||[ks[0]||'a',ks[1]||'b'];
  var back='\n\n如果你查到具體的班次，回答最後另起一行，照下面的格式寫一行（app 會讀這一行，不要放在程式碼區塊裡）：\n'
    +location.href.split('#')[0]+'#r='+TRIP.key+'/'+(cur+1)+'/起點代號~終點代號:出發-抵達,出發-抵達'
    +'\n例如 '+ex[0]+'~'+ex[1]+':0930-1005,1010-1045。時間用四位數字；好幾段就用分號隔開。只放你查得到、確定有開的班次。'
    +'\n地點代號：'+ks.map(function(k){return k+'＝'+PS[k]}).join('、');
  return '我正在旅行（'+TRIP.title+'）。旅遊助理 app 目前的狀態：\n'+txt+'\n\n請先講結論，簡短回答。'+q+back}
function askUrl(q,ex){return 'https://claude.ai/new?q='+encodeURIComponent(askText(q,ex))}
/* ---------- 階段四：在 app 裡問 Claude ----------
   app →（GitHub API）觸發私人 repo 的 Action →（帶 secret）觸發 Claude Code routine → Claude 查完把 answers/<編號>.json 推到 claude/answers → app 輪詢讀回來。
   GitHub 權杖只存在這支手機（localStorage），只能用在那個私人 repo。沒設定、失敗或逾時就退回跳到 Claude app 問。 */
var ASKK='ask-cfg',ASK_TIMEOUT=6*60000,askTimer=0;
function askCfg(){try{var c=JSON.parse(localStorage.getItem(ASKK)||'null');return c&&c.tok&&c.repo?c:null}catch(e){return null}}
function gh(path,opt){var c=askCfg();opt=opt||{};return fetch('https://api.github.com/repos/'+c.repo+path,{method:opt.method||'GET',cache:'no-store',body:opt.body,
  headers:Object.assign({'Authorization':'Bearer '+c.tok,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},opt.headers||{})})}
/* 問 Claude 的按鈕：設定好就在 app 裡問，否則照舊跳出去 */
function askBtn(q,ex,label,cls){if(askCfg())return '<button class="'+(cls||'opt ai')+'" data-askin="1" data-q="'+esc(q)+'" data-ex="'+esc((ex||[]).join(','))+'">'+label+'</button>';
  return '<a class="'+(cls||'opt ai')+'" href="'+askUrl(q,ex)+'" target="_blank" rel="noopener">'+label+'</a><button class="opt ghost" data-rtpaste="1">貼上 Claude 的回答</button>'}
function askStart(q,ex){var id='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  S.ask={id:id,t0:Date.now(),q:q,ex:ex,d:cur};save();sh={t:'ask'};render();
  gh('/actions/workflows/ask.yml/dispatches',{method:'POST',body:JSON.stringify({ref:'main',inputs:{id:id,text:askText(q,ex)}})})
    .then(function(r){if(r.status!==204)throw new Error('觸發失敗（GitHub 回 '+r.status+(r.status===401?'：權杖不對或過期':r.status===404?'：找不到 repo 或沒有權限':'')+'）');askPoll()})
    .catch(function(e){if(S.ask&&S.ask.id===id){S.ask.err=e.message||'連不上 GitHub';save();if(sh&&sh.t==='ask')drawSheet()}})}
function askPoll(){clearTimeout(askTimer);var a=S.ask;if(!a||a.res||a.err)return;
  if(Date.now()-a.t0>ASK_TIMEOUT){a.err='等了 6 分鐘還沒有答案。';save();if(sh&&sh.t==='ask')drawSheet();return}
  gh('/contents/answers/'+a.id+'.json?ref=claude%2Fanswers&_='+Date.now(),{headers:{'Accept':'application/vnd.github.raw+json'}}).then(function(r){
    if(r.status===200)return r.json().then(function(j){if(!S.ask||S.ask.id!==a.id)return;S.ask.res={answer:String(j.answer||''),r:String(j.r||''),sources:(j.sources||[]).slice(0,5)};save();vib([20,60,20]);
      if(!sh||sh.t==='ask'){sh={t:'ask'};render()}});
    askTimer=setTimeout(askPoll,8000)}).catch(function(){askTimer=setTimeout(askPoll,12000)})}
if(S.ask&&!S.ask.res&&!S.ask.err)setTimeout(askPoll,1500);
setInterval(function(){var e=document.getElementById('askel');if(e&&S.ask){var s2=Math.floor((Date.now()-S.ask.t0)/1000);e.textContent=Math.floor(s2/60)+':'+p2(s2%60)}},1000);
function vGuest(){var D=DAYS[cur],hk=D.hotel&&HOTELS[D.hotel];
  var h='<section class="stage go guest"><header class="hd"><div><b>'+esc(D.name)+'</b><span>'+dlabel(cur)+'</span></div></header>';
  if(G.t||G.p)h+='<div class="alert"><span class="lab">集合</span>'+(G.t?'<b class="num huge">'+esc(G.t)+'</b>':'')+(G.p?'<span class="why">'+esc(G.p)+'</span>':'')+'</div>'+(G.p?'<div class="acts"><a class="pb" href="'+mapUrl(G.p)+'" target="_blank" rel="noopener">'+ico('nav')+'導航</a></div>':'');
  h+='</section><div class="linemap">'+D.items.map(function(it){return '<a class="stop'+(it.kind==='wall'?' core':'')+'" href="'+navTo(cur,it.place)+'" target="_blank" rel="noopener"><span class="tcol num">'+(it.at?'<b class="hard">'+it.at+'</b>':'')+'</span><span class="rail"><span class="dot"></span></span><span class="body"><b>'+esc(it.name)+'</b></span></a>'}).join('')+'</div>';
  if(hk)h+='<div class="ticket"><div class="main"><div class="k">今晚</div><div class="t">'+esc(hk.jp)+'</div><div class="d">'+esc(hk.addr)+'</div></div><div class="stub"><a class="rb" href="'+navUrl({ll:hk.ll,q:hk.jp})+'" target="_blank" rel="noopener" aria-label="導航回飯店">'+ico('nav')+'</a></div></div><a class="tel solo" href="tel:'+esc(hk.tel)+'"><span>飯店</span><b class="num">'+esc(hk.tel)+'</b></a>';
  return h+'<button class="lk" data-leader="1">領隊版</button>'}
function vMore(){var bk=backBtn();
  if(sub==='wallet')return vWallet();
  if(sub==='money')return vMoney();
  if(sub==='group')return '<header class="hd">'+bk+'<div><b>傳給團員</b></div></header>'
     +'<div class="panel"><div class="row"><input type="time" id="mt" value="'+esc(S.meet.time||'')+'" aria-label="集合時間"><input type="text" id="mpl" value="'+esc(S.meet.place||'')+'" placeholder="集合地點" aria-label="集合地點" style="flex:1"></div>'
     +'<textarea id="gm" readonly aria-label="要傳的訊息" hidden>'+esc(groupText())+'</textarea>'
     +'<button class="pb wide" data-share="1">'+ico('nav')+'傳連結</button><div class="sub" id="cpm">團員點開就看到集合時間、今天行程、今晚飯店。</div></div>';
  if(sub==='sos'){var hk=DAYS[cur].hotel&&HOTELS[DAYS[cur].hotel];
    return '<header class="hd">'+bk+'<div><b>出事了</b></div></header>'
     +SOS.map(function(s,n){return '<div class="panel fold"><button class="fh" data-sos="'+n+'" aria-expanded="'+(sosOpen===n)+'">'+esc(s.t)+ico('chev')+'</button>'
       +(sosOpen===n?'<ol>'+s.steps.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ol>'+(s.tel||[]).map(function(t){return '<a class="tel" href="tel:'+esc(t[1])+'"><span>'+esc(t[0])+'</span><b class="num">'+esc(t[1])+'</b></a>'}).join(''):'')+'</div>'}).join('')
     +(hk?'<a class="tel solo" href="tel:'+esc(hk.tel)+'"><span>今晚飯店</span><b class="num">'+esc(hk.tel)+'</b></a>':'')}
  if(sub==='prep'){var td=ymd(new Date());
    return '<header class="hd">'+bk+'<div><b>出發前</b></div></header>'
     +'<div class="panel">'+SW.map(function(s){var lk=swLock(s);return '<div class="lbl">'+esc(s.name)+(lk?'<small>　🔒 '+esc(lk)+'</small>':'')+'</div>'+(lk&&/紀錄/.test(lk)?'<div class="row"><button class="gb" data-swclr="'+s.k+'">清掉這兩天的紀錄</button></div>':'')+'<div class="chips">'+s.opts.map(function(o){return '<button data-sw="'+s.k+'" data-v="'+o[0]+'"'+(lk?' disabled':'')+' class="chip'+(S.sw[s.k]===o[0]?' on':'')+'" aria-pressed="'+(S.sw[s.k]===o[0])+'">'+esc(o[1])+'</button>'}).join('')+'</div>'}).join('')+'</div>'
     +'<div class="panel">'+TODOS.filter(shown).map(function(x){var dn=S.done[x.id]!=null;return {x:x,dn:dn,due:!dn&&x.date&&td>=x.date}})
       .sort(function(a,b){return (a.dn-b.dn)||(b.due-a.due)||((a.x.date||'9')<(b.x.date||'9')?-1:1)})
       .map(function(r){return '<label class="todo'+(r.due?' due':'')+(r.dn?' done':'')+'"><input type="checkbox" data-todo="'+r.x.id+'"'+(r.dn?' checked':'')+'><div>'+esc(r.x.t)+'<small>'+esc(r.x.when)+'</small></div></label>'}).join('')+'</div>'}
  if(sub==='data'){var log=DAYS.map(function(d,i){var rows=d.items.filter(function(x){return S.done[K(i,x.id)]>1}).map(function(x){return '  '+x.name+'：'+fmt(S.done[K(i,x.id)])+' 離開'});var n=S.notes[DK(i)]?'  筆記：'+S.notes[DK(i)]:'';return rows.length||n?d.name+'\n'+rows.concat(n?[n]:[]).join('\n'):''}).filter(Boolean).join('\n\n');
    return '<header class="hd">'+bk+'<div><b>紀錄和備份</b></div></header>'
     +'<h2>實際時間和筆記</h2><textarea id="lg" readonly aria-label="實際紀錄">'+esc(log||'還沒有紀錄')+'</textarea><div class="row"><button class="gb" data-copy="lg">複製</button></div>'
     +(Object.keys(S.rt).length?'<h2>Claude 查到的班次</h2><p class="sub">'+Object.keys(S.rt).map(function(k){return '第 '+(DI(k)+1)+' 天 '+Object.keys(S.rt[k]).length+' 段'}).join('、')+'</p><div class="row"><button class="gb" data-rtclear="1">清掉，改回原本的班表</button></div>':'')
     +'<h2>重來</h2><div class="row"><button class="gb" data-reset="1">清掉今天的進度</button></div><h2>換手機</h2><textarea id="bk" class="mono" aria-label="備份資料">'+esc(JSON.stringify(S))+'</textarea><div class="row"><button class="gb" data-copy="bk">複製</button><button class="gb" data-imp="1">匯入</button><span class="sub" id="cpm"></span></div>'
     +(window.TripLock&&TripLock.sealed?'<h2>密碼</h2><p class="sub">這台手機記得行程密碼。借給別人或手機要送修前，可以先鎖起來，之後打開要重新輸入。</p><div class="row"><button class="gb" data-lock="1">鎖起來</button></div>':'')}
  if(sub==='mods'){var ML=mods(),bad=ML.filter(function(x){return x.bad}).length;
    if(!ML.length)return '<header class="hd">'+bk+'<div><b>手機上的修改</b></div></header><p class="sub">沒有修改。行程完全照發布的資料。</p>';
    var g='',last=null;ML.forEach(function(x,n){var hd=x.bad?'對不上（不會套用）':x.day;if(hd!==last){g+=(last!==null?'</div>':'')+'<h2>'+esc(hd)+'</h2><div class="panel">';last=hd}
      g+='<div class="item"><span>'+esc(x.t)+(x.bad?'<small>'+esc(x.day)+'</small>':'')+(x.v?'<small class="num">'+esc(x.v)+'</small>':'')+'</span><button class="mini" data-modclr="'+n+'">清掉</button></div>'});
    return '<header class="hd">'+bk+'<div><b>手機上的修改</b><span>'+ML.length+' 筆'+(bad?'，'+bad+' 筆對不上':'')+'</span></div></header>'
     +'<p class="sub">這些是在這支手機上改的，會蓋過發布的行程資料，要清掉才會消失。出發前在家測試過的，記得看一眼清掉。</p>'+g+'</div>'
     +'<div class="row"><button class="gb" data-modclr="all">全部清掉</button></div>'}
  if(sub==='askset'){var C=askCfg(),guess=(/^([^.]+)\.github\.io$/.exec(location.hostname)||[])[1];
    return '<header class="hd">'+bk+'<div><b>問 Claude 設定</b></div></header><p class="sub">設定好之後，「問 Claude」會留在 app 裡問，答案大約 2～3 分鐘後自己跳出來。權杖只存在這支手機，不會上傳。</p>'
     +'<div class="panel"><div class="lbl">私人 repo</div><input type="text" id="askrepo" value="'+esc(C?C.repo:(guess?guess+'/trip-ask':''))+'" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="私人 repo">'
     +'<div class="lbl">GitHub 權杖</div><input type="password" id="asktok" placeholder="'+(C?'已設定（要換才貼新的）':'github_pat_…')+'" autocomplete="off" aria-label="GitHub 權杖">'
     +'<div class="row"><button class="gb pri" data-askset="1">儲存並測試</button>'+(C?'<button class="gb" data-askclr="1">清除</button>':'')+'</div><p class="sub" id="askmsg">'+(C?'目前：已設定，問 Claude 會留在 app 裡。':'目前：沒設定，問 Claude 會跳到 Claude app。')+'</p></div>'}
  if(sub==='reh'){
    if(REH)return '<header class="hd">'+bk+'<div><b>演練</b></div></header><div class="panel"><div class="lbl">演練中</div><p>第 '+(REH.i+1)+' 天（'+esc(DAYS[REH.i].name)+'）。時間用這支手機的時鐘，天氣用示範。按的「到了」「走了」都另外存，不會算進正式行程。</p></div>'
      +'<div class="row"><button class="gb" data-reh="off">結束演練，丟掉演練進度</button></div><p class="sub">過了今天會自動結束。</p>';
    return '<header class="hd">'+bk+'<div><b>演練</b></div></header><p class="sub">出發前在台灣走一遍：選一天，app 會用這支手機現在的時間當那天的時間，你照著走、照常按「到了」「走了」，看提醒時機、操作順不順、耗不耗電。天氣用示範。進度另外存，正式出發時是乾淨的。</p>'
      +'<div class="menu">'+DAYS.map(function(d,k){return '<button data-reh="'+k+'"><span>第 '+(k+1)+' 天　'+esc(d.name)+'<small>'+dlabel(k)+'　'+esc(d.start||'')+(d.start?' 出發':'')+'</small></span>'+ico('chev')+'</button>'}).join('')+'</div>'}
  if(sub==='trips'){var TL=window.TripLock||{},md=function(x){return x.slice(5).replace('-','/')};
    return '<header class="hd">'+bk+'<div><b>換行程</b></div></header><p class="sub">打開 app 時會自動選正在進行、或最近要出發的那趟。每趟的進度和記帳各自存。</p><div class="menu">'
     +(TL.trips||[]).map(function(t){var on=t.key===TL.current;return '<button data-trip="'+esc(t.key)+'"'+(on?' aria-current="true"':'')+'><span>'+esc(t.title)+'<small>'+md(t.start)+' ～ '+md(t.end)+(on?'　現在這趟':'')+'</small></span>'+(on?ico('check'):ico('chev'))+'</button>'}).join('')+'</div>'}
  if(sub==='install')return '<header class="hd">'+bk+'<div><b>裝到主畫面</b></div></header>'
     +'<div class="panel"><div class="lbl">iPhone　Safari</div><ol><li>分享鈕</li><li>加入主畫面</li></ol></div>'
     +'<div class="panel"><div class="lbl">Android　Chrome</div><ol><li>右上角選單</li><li>安裝應用程式</li></ol></div>';
  function tile(s,t,ic,c){return '<button class="tile'+(c?' '+c:'')+'" data-sub="'+s+'">'+ico(ic)+'<b>'+t+'</b></button>'}
  function it(s,t){return '<button data-sub="'+s+'">'+t+ico('chev')+'</button>'}
  var k0=DAYS[cur].hotel;
  return '<header class="hd"><div><b>更多</b><span>'+esc(TRIP.title)+'</span></div></header>'
   +'<div class="tiles">'+tile('wallet','票夾','wallet')+tile('money','錢','money')+tile('group','傳給團員','people')+tile('sos','出事了','sos','sos')+'</div>'
   +(k0&&HOTELS[k0]?'<button class="tonight" data-desk="'+k0+'"><span>今晚住</span><b>'+esc(HOTELS[k0].jp)+'</b><i>給櫃檯看'+ico('chev')+'</i></button>':'')
   +'<div class="menu">'
   +'<button data-sheet="theme"><span>外觀<small>'+THEMES.filter(function(x){return x[0]===S.theme})[0][1]+'</small></span>'+ico('chev')+'</button>'
   +it('prep','出發前')+(mods().length?it('mods','手機上的修改（'+mods().length+'）'):'')+it('askset','問 Claude 設定')+(realIdx()<0||REH?it('reh',REH?'演練中（第 '+(REH.i+1)+' 天）':'演練'):'')+((window.TripLock&&(TripLock.trips||[]).length>1)?it('trips','換行程'):'')+it('data','紀錄和備份')+it('install','裝到主畫面')+'</div>'+'<p class="ver"><button class="verb" data-diag="1">版本 <span id="ver">'+esc(VER)+'</span></button></p>'}
/* 版本：顯示這台手機現在用的快取版號（sw.js 的 trip-vNN），確認新版有沒有生效 */
var VER='…';try{caches.keys().then(function(ks){var k=ks.filter(function(x){return /^trip-v\d+$/.test(x)}).sort(function(a,b){return +a.slice(6)-+b.slice(6)}).pop();VER=k?k.replace('trip-',''):'未快取';var e=document.getElementById('ver');if(e)e.textContent=VER})}catch(e){VER='—'}
/* 檢查畫面：點版號打開。列出手機實際回報的尺寸，截圖給 Claude 判斷底部那一條的原因。紅線＝網頁框的底，黃框＝整個螢幕 */
function diag(){var old=document.getElementById('diag');if(old){old.remove();return}
  function probe(css){var e=document.createElement('div');e.style.cssText='position:fixed;left:0;top:0;width:1px;visibility:hidden;'+css;document.body.appendChild(e);var r=e.getBoundingClientRect(),cs=getComputedStyle(e);var o={h:Math.round(r.height),pt:cs.paddingTop,pb:cs.paddingBottom};e.remove();return o}
  var sa=probe('padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'),vv=window.visualViewport,fr=document.getElementById('fx').getBoundingClientRect(),tb=document.getElementById('tabs').getBoundingClientRect();
  var rows=[['版本',VER],['iOS',(navigator.userAgent.match(/OS (\d+[_\d]*)/)||[])[1]||navigator.userAgent.slice(0,40)],['主畫面模式',String(!!navigator.standalone)+' / '+(matchMedia('(display-mode: standalone)').matches?'standalone':'browser')],
    ['螢幕 screen',screen.width+'×'+screen.height+'　dpr '+devicePixelRatio],['網頁框 inner',innerWidth+'×'+innerHeight],['outer',outerWidth+'×'+outerHeight],['html clientH',document.documentElement.clientHeight],
    ['visualViewport',vv?Math.round(vv.width)+'×'+Math.round(vv.height)+'　上移 '+Math.round(vv.offsetTop)+'　縮放 '+vv.scale:'無'],['安全區 上/下',sa.pt+' / '+sa.pb],
    ['100vh / svh / lvh / dvh',probe('height:100vh').h+' / '+probe('height:100svh').h+' / '+probe('height:100lvh').h+' / '+probe('height:100dvh').h],
    ['天空畫布',Math.round(fr.top)+' → '+Math.round(fr.bottom)],['導覽列底',Math.round(tb.bottom)],['--fullh',getComputedStyle(document.documentElement).getPropertyValue('--fullh')],['html 底色',document.documentElement.style.backgroundColor||'(預設)'],['body',document.body.className]];
  var d=document.createElement('div');d.id='diag';
  d.innerHTML='<div class="dg-line"></div><div class="dg-scr" style="height:'+screen.height+'px"></div><div class="dg-box"><b>檢查畫面</b><table>'+rows.map(function(r){return '<tr><th>'+esc(r[0])+'</th><td>'+esc(String(r[1]))+'</td></tr>'}).join('')+'</table><p>紅線＝網頁框的底　黃框＝整個螢幕的高度</p><div class="dg-fx"><span>到了／走了的轉場</span>'+[['cut','只有兩圈'],['bob','甲：字被抬起'],['gl','乙：轉盤的字被折射']].map(function(o){return '<button data-fxm="'+o[0]+'" class="'+(fxMode()===o[0]?'on':'')+'">'+o[1]+'</button>'}).join('')+'</div><button data-diag="1">關閉</button></div>';
  document.body.appendChild(d)}
/* ---------- 底部面板 ---------- */
var chg=null,tiltMsg=''; /* 「計畫有變」裡正在看的結果 */
function sheetHtml(){if(!sh)return '';var i=cur,D=DAYS[i],h='';
  if(sh.t==='desk'){var H=HOTELS[sh.id];if(!H)return '';
    return '<div class="desk"><button class="ib x" data-close="1" aria-label="關閉">'+ico('x')+'</button><div class="jp">'+esc(H.jp)+'</div><div class="en">'+esc(H.en)+'</div>'
     +'<div class="cds">'+H.codes.filter(shown).map(function(c){return '<div class="cc"><div class="code">'+esc(c.c)+'</div><div class="cd">'+esc(c.d)+'</div></div>'}).join('')+'</div>'
     +'<dl class="kv"><dt>Name</dt><dd>'+esc(TRIP.who)+'</dd><dt>Check-in</dt><dd>'+esc(H.ci)+'</dd><dt>Check-out</dt><dd>'+esc(H.co)+'</dd><dt>Payment</dt><dd>'+esc(H.pay)+'</dd></dl></div>'}
  if(sh.t==='change'){var m=vmOf(i),st=m.st;
    h='<div class="st">計畫有變？</div>';
    if(chg){h+='<p class="res">'+esc(chg.txt).replace(/\n/g,'<br>')+'</p><div class="grid"><button class="gb" data-chg="back">'+ico('undo')+'返回</button>'+(chg.apply?'<button class="gb pri" data-chg="go">'+ico('check')+'就這樣</button>':'')+'</div>';return h}
    if(m.st.here)h+='<button class="rowb" data-chg="early"><b>現在就走</b><span>看多出來的時間能做什麼</span></button>';
    D.items.forEach(function(it){var k=K(i,it.id);if(S.done[k]!=null||it.id===st.here)return;
      if(S.drop[k]){h+='<div class="rowb"><b class="off">'+esc(it.name)+'</b><button class="mini" data-chg="undrop" data-id="'+it.id+'">加回來</button></div>';return}
      h+='<div class="rowb"><b>'+esc(it.name)+'</b><button class="mini" data-chg="goto" data-id="'+it.id+'">直接去</button>'+(it.kind==='wall'&&it.id==='home'?'':'<button class="mini" data-chg="drop" data-id="'+it.id+'">不去了</button>')+'</div>'});
    return h+'<button class="rowb" data-sheet="askq"><b>問 Claude</b><span>其他狀況：打一句話，連同現在的行程一起問</span></button>'}
  if(sh.t==='stop'){var it=item(i,sh.id);if(!it)return '';var k=K(i,it.id),dn=S.done[k]!=null,dr=!!S.drop[k],stay=(S.cut[k]&&it.min!=null?it.min:(it.stay||0))+(S.ext[k]||0);
    h='<div class="ty">'+kindTxt(it)+'</div><div class="st">'+esc(it.name)+'</div>'+(it.at?'<div class="lt">'+it.at+' 前要到'+(it.cons?'（'+esc(it.cons)+'）':'')+'</div>':'')+(it.fallback?'<p class="sub">備案：'+esc(it.fallback)+'</p>':'');
    if(!dn&&!dr&&it.stay)h+='<div class="stepper"><span>預計停留（參考）</span><button class="ib" data-ext="'+it.id+'" data-v="-15" aria-label="少 15 分"'+(stay<=(it.min||0)?' disabled':'')+'>−</button><b class="num">'+stay+' 分</b><button class="ib" data-ext="'+it.id+'" data-v="15" aria-label="多 15 分">+</button></div>';
    h+='<div class="grid"><a class="gb" href="'+navTo(i,it.place)+'" target="_blank" rel="noopener">'+ico('nav')+'導航</a>'
     +(dn?'<button class="gb" data-undo="'+it.id+'">'+ico('undo')+'還沒去</button>':dr?'<button class="gb" data-chg="undrop" data-id="'+it.id+'">'+ico('undo')+'加回來</button>':'<button class="gb" data-chg="drop" data-id="'+it.id+'">'+ico('skip')+'不去了</button>')+'</div>';
    return h}
  if(sh.t==='route'){var mr=vmOf(i),nx=mr.next;if(!nx||!nx.ride)return '<div class="st">怎麼去</div><p class="sub">這段沒有路線資料</p>';
    h='<div class="ty">怎麼去</div><div class="st">'+esc(nx.it.name)+'</div>';
    nx.ride.hops.forEach(function(hp){h+='<div class="hop'+(hp.walk?' walk':'')+'"><div class="hl"><b class="num">'+(hp.walk?'':fmt(hp.dep))+'</b><span>'+(hp.walk?'':fmt(hp.arr)+' 到')+'</span></div><div class="hb"><b>'+esc(hp.how)+(hp.est?'（估）':'')+'</b><span>'+esc(pname(i,hp.from))+' → '+esc(pname(i,hp.to))+'</span></div>'
      +'<a class="mini" href="'+navTo(i,hp.walk?hp.to:hp.from)+'" target="_blank" rel="noopener">'+(hp.walk?'導航':'搭車處')+'</a></div>'});
    return h+'<div class="grid one"><a class="gb" href="'+transitUrl(i,nx.it.place)+'" target="_blank" rel="noopener">'+ico('nav')+'Google Maps 路線</a></div>'}
  if(sh.t==='members'){h='<div class="st">成員和分組</div><p class="sub">同一組的人結清時算一個單位，例如同房或一家人。</p>';
    S.mem.forEach(function(x){h+='<div class="mrow"><input type="text" value="'+esc(x.n)+'" data-mid="'+x.id+'" aria-label="名字"><div class="chips">'+[0,1,2,3].map(function(g){return '<button class="chip'+(x.g===g?' on':'')+'" data-grp="'+x.id+':'+g+'" aria-pressed="'+(x.g===g)+'">'+(g?'第'+g+'組':'不分組')+'</button>'}).join('')+'</div>'
      +(memUsed(x.id)?'':'<button class="ib sm" data-delm="'+x.id+'" aria-label="移除 '+esc(x.n)+'">'+ico('x')+'</button>')+'</div>'});
    return h+'<div class="grid"><button class="gb" data-addm="1">'+ico('plus')+'加一個人</button></div>'}
  if(sh.t==='theme'){h='<div class="st">外觀</div><p class="sub">換外觀不會改變內容和位置。</p>';
    THEMES.forEach(function(x){h+='<button class="rowb th'+(S.theme===x[0]?' on':'')+'" data-theme="'+x[0]+'" aria-pressed="'+(S.theme===x[0])+'"><b>'+x[1]+'</b><span>'+x[2]+'</span></button>'});
    if(S.theme==='glass'&&window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function')h+='<div class="grid"><button class="gb" data-tilt="1">'+(tiltMsg||'傾斜手機時，玻璃的光跟著動')+'</button></div>';
    return h}
  if(sh.t==='ask'){var A=S.ask;if(!A)return '<div class="st">問 Claude</div><p class="sub">沒有進行中的問題。</p>';
    var fb='<a class="gb" href="'+askUrl(A.q,A.ex)+'" target="_blank" rel="noopener">改用 Claude app 問</a>';
    if(A.res)return '<div class="ty">Claude 的回答</div><div class="st">'+esc(A.q||'現在的狀況')+'</div><p class="ans">'+esc(A.res.answer).replace(/\n/g,'<br>')+'</p>'
      +(A.res.sources.length?'<p class="sub">出處：'+A.res.sources.map(function(u,n){return /^https?:\/\//.test(u)?'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+(n+1)+'</a>':''}).join('　')+'</p>':'')
      +'<div class="grid'+(A.res.r?'':' one')+'"><button class="gb" data-askdone="1">知道了</button>'+(A.res.r?'<button class="gb pri" data-askr="1">看查到的班次</button>':'')+'</div>';
    if(A.err)return '<div class="ty">問 Claude</div><div class="st">沒有問到</div><p>'+esc(A.err)+'</p><div class="grid"><button class="gb" data-askdone="1">算了</button>'+fb+'</div>';
    return '<div class="ty">問 Claude</div><div class="st">正在問…　<span class="num" id="askel">0:00</span></div><p class="sub">'+esc(A.q||'現在的狀況')+'</p><p class="sub">Claude 在雲端查，通常 2～3 分鐘。可以先關掉這個面板做別的事，好了會自己跳出來。</p>'
      +'<div class="grid"><button class="gb" data-close="1">先關掉</button>'+fb+'</div>'}
  if(sh.t==='askq')return '<div class="ty">問 Claude</div><div class="st">想問什麼？</div>'
     +'<textarea id="askqt" rows="3" placeholder="例如：下雨了，下午改去哪裡比較好？" aria-label="想問 Claude 的問題">'+esc(sh.q||'')+'</textarea>'
     +'<p class="sub">'+(askCfg()?'會連同現在的行程一起送出，答案大約 2～3 分鐘後在 app 裡跳出來。':'會打開 Claude app，問題和現在的行程都幫你帶好了。（到「更多 → 問 Claude 設定」設定好，就能留在 app 裡問）')+'</p>'
     +'<div class="grid"><button class="gb" data-close="1">取消</button><button class="gb pri" data-askq="1">問</button></div>';
  if(sh.t==='rtin')return '<div class="ty">Claude 查到的班次</div><div class="st">貼上 Claude 的回答</div><p class="sub">在 Claude 那邊按回答下面的「複製」，回來長按下面的框貼上。整段貼上就好，app 會自己找出班次。</p>'
     +'<textarea id="rtin" rows="5" aria-label="貼上 Claude 的回答"></textarea>'+(sh.msg?'<p class="lt">'+esc(sh.msg)+'</p>':'')
     +'<div class="grid"><button class="gb" data-close="1">取消</button><button class="gb pri" data-rtread="1">讀取</button></div>';
  if(sh.t==='rt'){if(!RT)return '';var P2=RT.d!=null?DAYS[RT.d].places:{};
    if(RT.err)return '<div class="ty">Claude 查到的班次</div><div class="st">沒辦法套用</div><p>'+esc(RT.err)+'</p>'+(RT.other?'<div class="grid one"><button class="gb pri" data-trip="'+esc(RT.other)+'">換到那趟</button></div>':'');
    return '<div class="ty">Claude 查到的班次</div><div class="st">第 '+(RT.d+1)+' 天　'+esc(DAYS[RT.d].name)+'</div>'
     +Object.keys(RT.legs).map(function(lg){var ab=lg.split('>');return '<div class="rtl"><b>'+esc(P2[ab[0]])+' → '+esc(P2[ab[1]])+'</b><span class="num">'+RT.legs[lg].map(function(r){return r[0]+' → '+r[1]}).join('<br>')+'</span></div>'}).join('')
     +(RT.bad.length?'<p class="sub">看不懂、沒套用的部分：'+esc(RT.bad.join('；'))+'</p>':'')
     +'<p class="sub">套用後會照這些班次重排，畫面標成「參考」。不對的話，可以在「更多 → 紀錄和備份」清掉。</p>'
     +'<div class="grid"><button class="gb" data-close="1">不用</button><button class="gb pri" data-rtok="1">套用</button></div>'}
  if(sh.t==='wx')return '<div class="st">天氣</div>'+wxStrip(cur,nowMin(cur));
  if(sh.t==='miss'){var ms=(D.miss||[]).filter(shown);return '<div class="st">備案</div>'+(ms.length?ms.map(function(x){return '<div class="mi"><b>'+esc(x.b)+'</b><p>'+esc(x.d)+'</p></div>'}).join(''):'<p class="sub">這天沒有寫備案</p>')}
  if(sh.t==='note')return '<div class="st">筆記</div><textarea id="note" aria-label="今天的筆記" placeholder="實際花多久、踩到什麼雷">'+esc(S.notes[DK(cur)]||'')+'</textarea>';
  if(sh.t==='rate')return '<div class="st">匯率</div><div class="row">1 '+TRIP.cur+' = <input type="number" id="rate" step="0.0001" value="'+S.rate+'" aria-label="匯率"> '+TRIP.home+'</div>'+MONEY_NOTES.map(function(n){return '<p class="sub">'+esc(n)+'</p>'}).join('');
  return ''}

function drawSheet(){var c=sheetHtml();if(!c){sheet.hidden=true;sheet.className='';document.body.classList.remove('lock');return}
  var full=sh.t==='desk';sheet.className=full?'full':'';
  var keep=sheet.querySelector('.sb'),top=keep?keep.scrollTop:0;
  sheet.innerHTML=full?c:'<div class="bd" data-close="1"></div><div class="sb" role="dialog" aria-modal="true"><div class="grab" data-close="1"></div>'+c+'</div>';
  var was=sheet.hidden;sheet.hidden=false;document.body.classList.add('lock');
  var b=sheet.querySelector('.sb');if(b){if(was)b.classList.add('in');else b.scrollTop=top}}

var TABS=[['now','現在'],['plan','行程'],['more','更多']];
tabsEl.innerHTML='<i class="ind"></i>'+TABS.map(function(t){return '<button data-tab="'+t[0]+'">'+ico(t[0])+'<span>'+t[1]+'</span></button>'}).join('');
/* 天空：背景顏色跟著當地時間走，晚上有星星，下雨有雨絲 */
var SKY=[[0,'070B18','101C30'],[5,'15173A','40284F'],[7,'12305A','2A6788'],[12,'0D3A6E','197698'],[16,'18305F','54477A'],[18,'251B49','7E4347'],[20,'0B1124','1A2944'],[24,'070B18','101C30']];
function mix(a,b,t){var o='#';for(var n=0;n<3;n++){var x=parseInt(a.substr(n*2,2),16),y=parseInt(b.substr(n*2,2),16);o+=p2x(Math.round(x+(y-x)*t))}return o}
function p2x(n){return ('0'+n.toString(16)).slice(-2)}
function sky(t0){var h=t0/60,a=SKY[0],b=SKY[1];for(var n=0;n<SKY.length-1;n++)if(h>=SKY[n][0]&&h<=SKY[n+1][0]){a=SKY[n];b=SKY[n+1];break}
  var t=(h-a[0])/Math.max(.01,b[0]-a[0]);document.body.style.setProperty('--sky1',mix(a[1],b[1],t));document.body.style.setProperty('--sky2',mix(a[2],b[2],t))}
/* 外觀：結構不變，換的是一整包（材質、背景、動態） */
var THEMES=[['glass','天空玻璃','天空跟著當地時間和天氣變，面板是玻璃'],['plain','簡潔','不畫天空和動態，比較省電']];
if(window.Sky)Sky.init(document.getElementById('fx'),document.getElementById('drops'));
/* 預熱乙案：開 app 1.5 秒後把轉盤的字畫一次到畫面外，第一次「到了／走了」就不會慢一兩格 */
setTimeout(function(){try{if(!window.Sky||!Sky.warm||fxMode()!=='gl')return;var d=app.querySelector('.dial');if(!d)return;var b=d.getBoundingClientRect();
  Sky.warm(textCanvas(app,{x:b.left-24,y:b.top-24,w:b.width+48,h:b.height+48}))}catch(e){}},1500);
function skyRender(){var glass=S.theme==='glass'&&!!window.Sky;document.body.classList.toggle('th-glass',glass);var t0=nowMin(cur);
  if(glass){var D=DAYS[cur];Sky.set({scape:D.scape,lat:D.ll[0],lng:D.ll[1],at:skyAt(cur,t0),wx:skyWx(cur,t0)});Sky.on(true);Sky.poke()}
  else{if(window.Sky)Sky.on(false);sky(t0)}}
var planAnim=true,lastTab='',arrFx=null,waveEnd=null;
/* D3「到了／走了」：水滴落在手指按的地方（lastPt），從那裡用兩圈換頁（見下面 waveFx）。
   換畫面前把 #app 複製一份疊在上面當舊頁；波速＝畫面高 × 0.62／秒（跟 sky.js 第一圈一樣）。減少動態效果時直接換。
   同一時間只有一個轉場：新的開始前先把上一個收尾（waveEnd）。 */
var lastPt=null;document.addEventListener('pointerdown',function(e){lastPt={x:e.clientX,y:e.clientY,t:Date.now()}},true);
function dropFx(btn){var br=btn.getBoundingClientRect(),p=lastPt&&Date.now()-lastPt.t<1500?lastPt:{x:br.left+br.width/2,y:br.top+br.height/2};
  if(window.Sky&&Sky.drop)Sky.drop(p.x,p.y);if(calm)return;arrFx={x:p.x,y:p.y,t0:performance.now(),v:Math.max(300,innerHeight*.62)}}
function mkOld(){var o=app.cloneNode(true);o.classList.add('xold');o.setAttribute('aria-hidden','true');
  o.querySelectorAll('[id]').forEach(function(e){e.removeAttribute('id')});o.querySelectorAll('.burst').forEach(function(e){e.classList.remove('burst')});
  app.parentNode.insertBefore(o,app.nextSibling);o.scrollTop=app.scrollTop;document.body.classList.add('xfade');return o}
/* 兩圈換頁（D3 定案）：外圈 Ro 洗掉舊頁、內圈 Rn＝(t−GAP)×波速 帶出新頁，中間一圈空帶只有天空和水波，新舊兩頁不會碰在一起。
   舊頁複本：Ro 外看得到；新頁 #app：Rn 內看得到。sky.js 的玻璃用同樣兩圈（Sky.wave）。 */
var WAVE_GAP=.32,WAVE_E=18,BOB_W=60,BOB_A=6,BOB_B=.04;
/* 轉場效果（「更多 → 點版號」的檢查畫面切換）：cut＝只有兩圈；bob＝甲案，字被波抬起來；gl＝乙案（預設），轉盤的字畫進 WebGL、其他照甲案 */
function fxMode(){return S.fx||'gl'}
/* 甲案：找出一層裡要動的單位（區塊；轉盤只動 .lab、.rem 和大字的每一個字），量好中心存起來 */
function bobUnits(root,noDialText){var U=[],add=function(e){var r=e.getBoundingClientRect();if(r.width&&r.height)U.push({e:e,x:r.left+r.width/2,y:r.top+r.height/2})};
  root.querySelectorAll('.stage > :not(.hd), .hd > *').forEach(function(e){
    if(!e.classList.contains('dial')){add(e);return}
    if(noDialText)return;e.querySelectorAll('.lab,.rem').forEach(add);var bg=e.querySelector('.big');if(!bg)return;
    var rl=bg.querySelector('.roll');if(rl){[].forEach.call(rl.children,add);return}
    var t=bg.querySelector('.txt')||bg;if(!t.dataset.orig){t.dataset.orig=t.innerHTML;t.innerHTML=Array.from(t.textContent).map(function(c){return /\s/.test(c)?c:'<span class="bc">'+esc(c)+'</span>'}).join('')}
    t.querySelectorAll('.bc').forEach(add)});
  return U}
function bobFrame(U,x,y,R){U.forEach(function(u){var dx=u.x-x,dy=u.y-y,dist=Math.hypot(dx,dy)||1,d=dist-R,l=Math.exp(-(d/BOB_W)*(d/BOB_W));
  u.e.style.transform=l<.01?'':'translate('+(dx/dist*BOB_A*l).toFixed(2)+'px,'+(dy/dist*BOB_A*l).toFixed(2)+'px) scale('+(1+BOB_B*l).toFixed(4)+')'})}
/* 乙案：把一層轉盤的三段字（.lab .big .rem）照 DOM 的位置一個字一個字畫到 canvas；字型、顏色、陰影從 getComputedStyle 拿 */
var GLSEL='.dial .lab,.dial .big,.dial .rem';
function textCanvas(root,R){var dpr=window.devicePixelRatio||1,c=document.createElement('canvas');c.width=Math.ceil(R.w*dpr);c.height=Math.ceil(R.h*dpr);var g=c.getContext('2d');g.scale(dpr,dpr);
  var put=function(ch,rc,el){var st=getComputedStyle(el);g.font=st.fontStyle+' '+st.fontWeight+' '+st.fontSize+' '+st.fontFamily;g.fillStyle=st.color;
    var sh=/(rgba?\([^)]*\)|#[0-9a-f]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/i.exec(st.textShadow||'');
    if(sh){g.shadowColor=sh[1];g.shadowOffsetX=+sh[2]*dpr;g.shadowOffsetY=+sh[3]*dpr;g.shadowBlur=+sh[4]*dpr}else g.shadowColor='transparent';
    var m=g.measureText(ch),a=m.fontBoundingBoxAscent!=null?m.fontBoundingBoxAscent:m.actualBoundingBoxAscent,d=m.fontBoundingBoxDescent!=null?m.fontBoundingBoxDescent:m.actualBoundingBoxDescent;
    g.fillText(ch,rc.left-R.x+(rc.width-m.width)/2,rc.top-R.y+(rc.height-(a+d))/2+a)};
  root.querySelectorAll(GLSEL).forEach(function(el){
    el.querySelectorAll('.dg').forEach(function(dg){var i=dg.querySelector('i');if(i)put(i.dataset.to,dg.getBoundingClientRect(),i)});
    var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null),t;
    while(t=w.nextNode()){if(t.parentNode.closest('.dg,.sr'))continue;for(var k=0;k<t.nodeValue.length;k++){var ch=t.nodeValue[k];if(!ch.trim())continue;
      var rg=document.createRange();rg.setStart(t,k);rg.setEnd(t,k+1);var rc=rg.getClientRects()[0];if(rc&&rc.width>1)put(ch,rc,t.parentNode)}}});
  return c}
/* 開始乙案：兩層都有轉盤才做；做不起來回 null（退回甲案） */
function glDial(old,neu){var dO=old.querySelector('.dial'),dN=neu.querySelector('.dial');if(!dO||!dN||!window.Sky||!Sky.text)return null;
  var a=dO.getBoundingClientRect(),b=dN.getBoundingClientRect(),P=24,x=Math.min(a.left,b.left)-P,y=Math.min(a.top,b.top)-P,R={x:x,y:y,w:Math.max(a.right,b.right)+P-x,h:Math.max(a.bottom,b.bottom)+P-y};
  if(!Sky.text(textCanvas(old,R),textCanvas(neu,R),R))return null;
  var hid=[].slice.call(old.querySelectorAll(GLSEL)).concat([].slice.call(neu.querySelectorAll(GLSEL)));hid.forEach(function(e){e.style.visibility='hidden'});
  return {done:function(){hid.forEach(function(e){e.style.visibility=''});Sky.text(null)}}}
function bobClear(U){U.forEach(function(u){u.e.style.transform=''});app.querySelectorAll('[data-orig]').forEach(function(t){t.innerHTML=t.dataset.orig;t.removeAttribute('data-orig')})}
function waveMask(el,x,y,a,b){var m='radial-gradient(circle at '+x.toFixed(1)+'px '+y.toFixed(1)+'px, '+a+')';el.style.webkitMaskImage=m;el.style.maskImage=m}
function waveFx(fx,old){if(!old)return;var E=WAVE_E,far=0;[[0,0],[innerWidth,0],[0,innerHeight],[innerWidth,innerHeight]].forEach(function(c){far=Math.max(far,Math.hypot(c[0]-fx.x,c[1]-fx.y))});
  var clr=function(el){el.style.webkitMaskImage='';el.style.maskImage=''},done=false,
    gd=fxMode()==='gl'?glDial(old,app):null,bob=fxMode()!=='cut',UO=bob?bobUnits(old,!!gd):[],UN=bob?bobUnits(app,!!gd):[],
    to=0,end=function(){if(done)return;done=true;clearTimeout(to);if(waveEnd===end)waveEnd=null;if(window.Sky&&Sky.pre)Sky.pre(null);clr(app);bobClear(UN);if(gd)gd.done();if(old.parentNode)old.remove();document.body.classList.remove('xfade');if(window.Sky&&Sky.wave)Sky.wave(null)},
    frame=function(){var t=(performance.now()-fx.t0)/1000,Ro=t*fx.v,Rn=Math.max(0,t-WAVE_GAP)*fx.v;
      waveMask(old,fx.x,fx.y,'transparent '+Math.max(0,Ro-E).toFixed(1)+'px, #000 '+(Ro+E).toFixed(1)+'px');
      if(Rn<=0){app.style.webkitMaskImage=app.style.maskImage='linear-gradient(transparent,transparent)'}
      else waveMask(app,fx.x,fx.y,'#000 '+Math.max(0,Rn-E).toFixed(1)+'px, transparent '+(Rn+E).toFixed(1)+'px');
      if(bob){bobFrame(UO,fx.x,fx.y,Ro);bobFrame(UN,fx.x,fx.y,Rn)}
      if(window.Sky&&Sky.wave)Sky.wave(fx.x,fx.y,Ro,Rn);return Rn-E>far};
  frame(); /* 跟換 innerHTML 同一段：新頁一開始就全遮，不會先閃一下 */
  if(gd&&Sky.draw)Sky.draw(); /* 轉盤的字剛從 DOM 藏起來，GL 這一刻就畫上 */
  /* sky.js 的 loop 每一幀在畫之前叫 tick，GL 和遮罩同一幀更新；自己的 rAF 也跑當保險（loop 停了也不會卡在半路）。兩邊都用當下時間算，重複叫沒關係 */
  var tick=function(){if(!done&&frame())end()};
  if(window.Sky&&Sky.pre)Sky.pre(tick);
  (function step(){if(done)return;if(frame())end();else requestAnimationFrame(step)})();
  to=setTimeout(end,4000);waveEnd=end}
function render(){
  document.body.dataset.tab=G?'guest':tab;skyRender();
  if(G){tabsEl.hidden=true;app.innerHTML=vGuest();drawSheet();return}
  tabsEl.hidden=false;
  TABS.forEach(function(t,n){var b=tabsEl.children[n+1],on=tab===t[0];b.className=on?'on':'';if(on){b.setAttribute('aria-current','page');tabsEl.style.setProperty('--ti',n)}else b.removeAttribute('aria-current')});
  if(arrFx&&waveEnd)waveEnd(); /* 上一個轉場還沒完：馬上收尾，複本才不會帶著遮罩、位移和藏起來的字 */
  var oldEl=arrFx?mkOld():null;noRoll=!!arrFx;
  app.innerHTML=tab==='now'?vNow():tab==='plan'?vPlan():vMore();
  noRoll=false;
  if(tab!==lastTab){app.scrollTop=0;lastTab=tab}
  if(arrFx){var fx0=arrFx;arrFx=null;waveFx(fx0,oldEl)} /* 頁面本身不捲，捲的是 #app；換分頁時回到最上面 */
  var a=document.getElementById('arc'),hd=document.getElementById('hdot'),rl=document.querySelector('.roll');
  lastBig=rl?rl.dataset.s:'';if(a)lastFrac=+a.dataset.f;
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    if(a){a.setAttribute('stroke-dashoffset',a.dataset.to);hd.style.transform='rotate('+hd.dataset.to+'deg)'}
    [].forEach.call(document.querySelectorAll('.dg i'),function(el){el.style.transform='translateY(-'+el.dataset.to+'em)'})})});
  if(tab==='plan'){var lm=document.querySelector('.linemap');if(lm&&planAnim&&!calm){lm.classList.add('draw');[].forEach.call(lm.children,function(el,n){el.style.setProperty('--i',n)})}planAnim=false}
  drawSheet()}
/* 使用者操作造成的重畫：支援的瀏覽器會有轉場 */
var calm=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
function paint(){if(arrFx){render();return}if(document.startViewTransition&&!calm&&sheet.hidden&&!sh){try{document.startViewTransition(render);return}catch(e){}}render()}
function copyFrom(id){var el=document.getElementById(id),m=document.getElementById('cpm');if(!el)return;
  function ok(){if(m)m.textContent='已複製'}function manual(){el.hidden=false;el.focus();el.select();if(m)m.textContent='已選取，長按複製'}
  try{navigator.clipboard.writeText(el.value).then(ok,manual)}catch(e){manual()}}
function stamp(){var m=nowMin(cur);return m>1?m:2}

document.addEventListener('click',function(e){
  var t=e.target.closest('button,a,[data-close]');if(!t||!t.dataset)return;var d=t.dataset,id,i=cur,k;
  if(d.close){if(sh&&sh.t==='rt'){clearHash();RT=null}sh=null;chg=null;render();return}
  if(d.tab)go(d.tab);
  else if(d.sub!=null)go('more',d.sub);
  else if(d.sheet){sh={t:d.sheet,id:d.id};chg=null;render()}
  else if(d.desk){sh={t:'desk',id:d.desk};render()}
  else if(d.day){cur=+d.day;whatIf=null;planAnim=true;paint()}
  else if(d.loc)locate(false);
  else if(d.grp){var gp=d.grp.split(':');mem(gp[0]).g=+gp[1];save();render()}
  else if(d.delm){S.mem=S.mem.filter(function(x){return x.id!==d.delm});save();render()}
  else if(d.addm){S.mem.push({id:'m'+Date.now().toString(36),n:'新成員',g:0});save();render()}
  else if(d.done){vib([12,40,18]);dropFx(t,1200);whatIf=null;id=d.done;var m0=vmOf(i),dl=document.querySelector('.dial'),fin=function(){
      if(m0.st.here===id)finish(i,id);else S.here[DK(i)]={id:id,t:nowMin(i)};save();paint()};
    if(dl&&!calm&&tab==='now'){dl.classList.add('burst');setTimeout(fin,260)}else fin()}
  else if(d.undo){k=K(i,d.undo);delete S.done[k];
    /* 是最後一次按的「走了」：退回那時候的位置 */
    var hs=S.hist.filter(function(x){return x.i===DK(i)}),hl=hs[hs.length-1];
    if(hl&&hl.k===k){S.hist.splice(S.hist.lastIndexOf(hl),1);
      if(hl.at==null)delete S.at[DK(i)];else S.at[DK(i)]=hl.at;if(hl.last==null)delete S.lastT[DK(i)];else S.lastT[DK(i)]=hl.last;
      S.here[DK(i)]=hl.here||{id:d.undo,t:nowMin(i)}}
    save();sh=null;render()}
  else if(d.tilt){DeviceOrientationEvent.requestPermission().then(function(r){tiltMsg=r==='granted'?'已開啟，傾斜手機看看':'沒有開啟（可以到 Safari 設定允許動作與方向）';render()},function(){tiltMsg='這裡無法開啟';render()})}
  else if(d.theme){S.theme=d.theme;save();vib();render()}
  else if(d.dwx){var di=DWX.map(function(x){return x[0]}).indexOf(S.dwx||'');S.dwx=DWX[(di+1)%DWX.length][0];save();render()}
  else if(d.arrive){vib([12,40,18]);dropFx(t,900);S.here[DK(i)]={id:d.arrive,t:nowMin(i)};whatIf=null;save();paint()}
  else if(d.skipit){vib();S.drop[K(i,d.skipit)]=1;save();paint()}
  else if(d.ext){id=d.ext;k=K(i,id);var it=item(i,id),v=+d.v;if(v<0&&S.ext[k]>0)S.ext[k]=Math.max(0,S.ext[k]+v);else if(v<0){if(it.min!=null)S.cut[k]=1}else if(S.cut[k])delete S.cut[k];else S.ext[k]=(S.ext[k]||0)+v;save();render()}
  else if(d.rx){vib();var r=lastRx[+d.rx];if(r){applyRx(i,r);save();paint()}}
  else if(d.wi){var m=vmOf(i);if(d.wi==='ok'&&m.st.here&&whatIf!=null){vib();S.pin[K(i,m.st.here)]=whatIf;save()}whatIf=null;render()}
  else if(d.chg){var mm=vmOf(i),P=mm.P,st=mm.st;id=d.id;
    if(d.chg==='back')chg=null;
    else if(d.chg==='arrive'){S.here[DK(i)]={id:id,t:nowMin(i)};save();sh=null}
    else if(d.chg==='early')chg={txt:P.early(st),apply:{done:st.here}};
    else if(d.chg==='goto'){var lost=[];for(var q=0;q<DAYS[i].items.length&&DAYS[i].items[q].id!==id;q++){var x=DAYS[i].items[q],kk=K(i,x.id);if(S.done[kk]==null&&!S.drop[kk]&&x.id!==st.here)lost.push(x.id)}
      chg={txt:P.goto(st,id),apply:{done:st.here,drop:lost}}}
    else if(d.chg==='drop'){var it2=item(i,id),s2=JSON.parse(JSON.stringify(st));s2.drop[id]=1;var p2=P.plan(s2);
      chg={txt:'不去「'+it2.name+'」'+(it2.kind!=='soft'?'（這是'+kindTxt(it2)+'的）':'')+'。\n'+(p2.issues.length?'但「'+p2.issues[0].it.name+'」'+p2.issues[0].why+'。':p2.unknown?'之後 '+pname(i,p2.unknown.from)+' → '+pname(i,p2.unknown.it.place)+' 沒有資料，要現場查。':'後面都來得及。'),apply:{drop:[id]}}}
    else if(d.chg==='undrop'){delete S.drop[K(i,id)];save();if(sh&&sh.t==='stop')sh=null}
    else if(d.chg==='go'&&chg&&chg.apply){vib();(chg.apply.drop||[]).forEach(function(x){S.drop[K(i,x)]=1});if(chg.apply.done)finish(i,chg.apply.done);save();chg=null;sh=null}
    render()}
  else if(d.fxm){S.fx=d.fxm;save();diag();diag()}
  else if(d.diag)diag()
  else if(d.lock){if(window.TripLock)TripLock.forget()}
  else if(d.reh!=null){try{if(d.reh==='off'){localStorage.removeItem(RK);localStorage.removeItem(TRIP.key+':reh')}
      else{var seed={sw:S.sw,theme:S.theme,rate:S.rate,mem:S.mem,dwx:S.dwx||'clear'};localStorage.setItem(TRIP.key+':reh',JSON.stringify(seed));localStorage.setItem(RK,JSON.stringify({i:+d.reh,on:localYmd()}))}}catch(e){}
    location.reload()}
  else if(d.rtok){if(RT&&RT.legs){var o2=S.rt[DK(RT.d)]=S.rt[DK(RT.d)]||{};Object.keys(RT.legs).forEach(function(lg){var have={};(o2[lg]=o2[lg]||[]).forEach(function(r){have[r[0]]=1});RT.legs[lg].forEach(function(r){if(!have[r[0]])o2[lg].push(r)})});save()}
    clearHash();location.reload()}
  else if(d.askq){var qt=document.getElementById('askqt'),qq=(qt&&qt.value||'').trim();if(!qq){if(qt)qt.focus();return}
    if(askCfg())askStart(qq,null);else{window.open(askUrl(qq),'_blank','noopener');sh=null;render()}}
  else if(d.modclr!=null){var ML2=mods(),hasRt=false;
    if(d.modclr==='all'){if(!confirm('清掉這支手機上全部 '+ML2.length+' 筆修改，回到發布的行程？'))return;ML2.forEach(function(x){if(x.f==='rt')hasRt=true;modClear(x.f,x.k)})}
    else{var x2=ML2[+d.modclr];if(!x2)return;hasRt=x2.f==='rt';modClear(x2.f,x2.k)}
    save();if(hasRt)location.reload();else render()}
  else if(d.askin){askStart(d.q,d.ex?d.ex.split(','):null)}
  else if(d.askdone){delete S.ask;save();sh=null;render()}
  else if(d.askr){var rr=S.ask&&S.ask.res&&(rtFrom(S.ask.res.r)||S.ask.res.r.replace(/^#?r=/,''));if(rr){parseRt(rr);sh={t:'rt'};render()}}
  else if(d.askset){var rp=(document.getElementById('askrepo').value||'').trim(),tk=(document.getElementById('asktok').value||'').trim(),old=askCfg(),msg=document.getElementById('askmsg');
    if(!tk&&old)tk=old.tok;if(!/^[\w.-]+\/[\w.-]+$/.test(rp)||!tk){msg.textContent='repo 要像 帳號/trip-ask，權杖也要填。';return}
    try{localStorage.setItem(ASKK,JSON.stringify({repo:rp,tok:tk}))}catch(e){}msg.textContent='測試中…';
    gh('/actions/workflows/ask.yml').then(function(r){msg.textContent=r.ok?'✓ 可以用了。問 Claude 會留在 app 裡。':'✗ 不行（GitHub 回 '+r.status+'）：檢查 repo 名稱、權杖的權限（Actions 讀寫、Contents 唯讀）和期限。'},function(){msg.textContent='✗ 連不上 GitHub，等有網路再試。'})}
  else if(d.askclr){try{localStorage.removeItem(ASKK)}catch(e){}render()}
  else if(d.rtpaste){var openIn=function(){sh={t:'rtin'};render();setTimeout(function(){var x=document.getElementById('rtin');if(x)x.focus()},350)};
    try{navigator.clipboard.readText().then(function(txt){var r=rtFrom(txt);if(r){parseRt(r);sh={t:'rt'};render()}else openIn()},openIn)}catch(e){openIn()}}
  else if(d.rtread){var tv=(document.getElementById('rtin')||{}).value||'',r2=rtFrom(tv);
    if(!r2){sh={t:'rtin',msg:'這段文字裡找不到班次（要有 #r= 開頭的那一行）。請 Claude 照 app 給的格式補上。'};render()}else{parseRt(r2);sh={t:'rt'};render()}}
  else if(d.rtclear){S.rt={};save();location.reload()}
  else if(d.trip){if(window.TripLock&&d.trip!==TripLock.current)TripLock.pick(d.trip)}
  else if(d.swclr){var s1=SW.filter(function(x){return x.k===d.swclr})[0];if(!s1||!s1.days)return;
    if(confirm('清掉第 '+(s1.days[0]+1)+'、'+(s1.days[1]+1)+' 天的到了、走了、不去、延長等紀錄？筆記會留著。清掉後就能對調。')){clearDays(s1.days.map(DK));save();render()}}
  else if(d.sw){var sw0=SW.filter(function(x){return x.k===d.sw})[0];if(sw0&&swLock(sw0))return;if(S.sw[d.sw]!==d.v){S.sw[d.sw]=d.v;save();location.reload()}}
  else if(d.sos){sosOpen=sosOpen===+d.sos?-1:+d.sos;render()}
  else if(d.payer){[].forEach.call(document.querySelectorAll('#epc .chip'),function(b){var on=b===t;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}
  else if(d.am){t.classList.toggle('on');t.setAttribute('aria-pressed',t.classList.contains('on'))}
  else if(d.addexp){var a=parseFloat(document.getElementById('ea').value),em=document.getElementById('em');
    if(!(a>0)){em.textContent='先填金額';return}
    var am=[].map.call(document.querySelectorAll('#eam .on'),function(b){return b.dataset.am});if(!am.length){em.textContent='至少選一個人分';return}
    vib();S.exp.push({id:'e'+Date.now(),amt:a,note:document.getElementById('en').value.trim(),payer:document.querySelector('#epc .on').dataset.payer,among:am,day:cur});save();render()}
  else if(d.delexp){S.exp=S.exp.filter(function(x){return x.id!==d.delexp});save();render()}
  else if(d.copy)copyFrom(d.copy);
  else if(d.share){var txt=groupText();if(navigator.share)navigator.share({text:txt}).catch(function(){});else copyFrom('gm')}
  else if(d.leader){history.replaceState(null,'',location.pathname+location.search);G=null;cur=Math.max(0,liveIdx());render()}
  else if(d.reset){['done','drop','cut','ext','pin','here','at','lastT'].forEach(function(n){S[n]={}});S.hist=[];whatIf=null;save();render()}
  else if(d.imp){var mg=document.getElementById('cpm');try{var o=JSON.parse(document.getElementById('bk').value);if(o&&o.sw&&o.done){S=o;norm();save();render()}else mg.textContent='格式不對'}catch(err){mg.textContent='格式不對'}}
});

document.addEventListener('change',function(e){var t=e.target;
  if(t.dataset&&t.dataset.todo){if(t.checked)S.done[t.dataset.todo]=1;else delete S.done[t.dataset.todo];save();render()}
  else if(t.id==='pv')render()});
var deb=null;function later(){clearTimeout(deb);deb=setTimeout(save,600)}
document.addEventListener('input',function(e){var t=e.target;
  if(t.id==='pv'){S.pv[DK(cur)]=+t.value;t.style.setProperty('--pvp',(t.value/14.35).toFixed(1)+'%');document.getElementById('pvv').textContent=fmt(+t.value);later()}
  else if(t.id==='note'){S.notes[DK(cur)]=t.value;later()}
  else if(t.id==='rate'){if(+t.value>0){S.rate=+t.value;later()}}
  else if(t.id==='ea'){document.getElementById('cvo').textContent='≈ '+money((parseFloat(t.value)||0)*S.rate)+' '+TRIP.home}
  else if(t.id==='mt'||t.id==='mpl'){S.meet={time:document.getElementById('mt').value,place:document.getElementById('mpl').value};document.getElementById('gm').value=groupText();later()}
  else if(t.dataset&&t.dataset.mid){mem(t.dataset.mid).n=t.value.trim()||'?';later()}});
/* 拖電車 */
/* 拖電車：位置就是時間 */
function dragAt(e){var m=vmOf(cur),sv=app.querySelector('.lline');if(!sv||m.kind!=='here')return;var b=sv.getBoundingClientRect(),w=winOf(m),px=(e.clientX-b.left)/b.width*360;
  var t=w.a+Math.max(0,Math.min(1,(px-24)/312))*(w.b-w.a),v=Math.round(Math.max(m.now,t)/5)*5;
  if(v!==whatIf){var q=function(x){var h=m.P.hard(m.st,{leaveAt:x});return h.fail?2:(h.lost.length>m.lost.length||h.gap)?1:0},was=whatIf!=null?q(whatIf):0;whatIf=v;if(was!==q(v))vib();render()}}
app.addEventListener('pointerdown',function(e){if(tab!=='now'||G||!e.target.closest('.lw:not(.off)'))return;win=null;winOf(vmOf(cur));wdrag=1;document.body.classList.add('dragging');try{app.setPointerCapture(e.pointerId)}catch(x){}vib();dragAt(e);e.preventDefault()});
app.addEventListener('pointermove',function(e){if(wdrag)dragAt(e)});
['pointerup','pointercancel'].forEach(function(n){app.addEventListener(n,function(){if(!wdrag)return;wdrag=null;document.body.classList.remove('dragging');render()})});
var tx=0,ty=0,tOn=null;
document.addEventListener('touchstart',function(e){var p=e.touches[0];tx=p.clientX;ty=p.clientY;
  tOn=e.target.closest('.sb')?'sheet':(e.target.closest('#map,input,.days,.runs,.lw')?null:'page')},{passive:true});
document.addEventListener('touchmove',function(e){if(tOn!=='sheet')return;var b=sheet.querySelector('.sb');if(!b||b.scrollTop>0)return;
  var dy=e.touches[0].clientY-ty;if(dy>0)b.style.transform='translateY('+dy+'px)'},{passive:true});
document.addEventListener('touchend',function(e){var p=e.changedTouches[0],dx=p.clientX-tx,dy=p.clientY-ty;
  if(tOn==='sheet'){var b=sheet.querySelector('.sb');if(b){if(dy>90&&b.scrollTop<=0){sh=null;chg=null;render()}else b.style.transform=''}}
  else if(tOn==='page'&&tab==='plan'&&!sh&&Math.abs(dx)>70&&Math.abs(dy)<50){var n=cur+(dx<0?1:-1);if(n>=0&&n<DAYS.length){cur=n;planAnim=true;paint()}}
  tOn=null},{passive:true});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&sh){sh=null;chg=null;render()}});
window.addEventListener('hashchange',function(){readHash();readRt();if(RT)sh={t:'rt'};render()});
document.addEventListener('visibilitychange',function(){if(window.Sky)Sky.on(S.theme==='glass'&&!document.hidden);if(!document.hidden){autoLocate();if(liveIdx()>=0&&!sh)render()}});
/* 按下玻璃：光從手指的位置盪開 */
var RIP='.pb,.gb,.gb2,.bind,.askbar,.tile,.opt,.rowb,.menu button,.tonight,.chip,.days button,#tabs button,.mini';
document.addEventListener('pointerdown',function(e){if(calm||S.theme!=='glass')return;var t=e.target.closest&&e.target.closest(RIP);if(!t)return;
  var r=t.getBoundingClientRect(),d=Math.max(r.width,r.height)*2.2,s=document.createElement('span');s.className='ripl';
  s.style.cssText='width:'+d+'px;height:'+d+'px;left:'+(e.clientX-r.left-d/2)+'px;top:'+(e.clientY-r.top-d/2)+'px';t.appendChild(s);setTimeout(function(){s.remove()},650)},{passive:true});
/* 票卡：手指滑過有反光，按住會微微傾斜 */
document.addEventListener('pointermove',function(e){var t=e.target.closest&&e.target.closest('.ticket');if(!t||calm)return;var r=t.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  t.style.setProperty('--mx',(x*100).toFixed(1)+'%');t.style.setProperty('--rx',((.5-y)*7).toFixed(2)+'deg');t.style.setProperty('--ry',((x-.5)*9).toFixed(2)+'deg');t.classList.add('lit')},{passive:true});
['pointerup','pointercancel','pointerleave'].forEach(function(n){document.addEventListener(n,function(e){[].forEach.call(document.querySelectorAll('.ticket.lit'),function(t){t.classList.remove('lit');t.style.removeProperty('--rx');t.style.removeProperty('--ry')})},true)});
render();autoLocate();
/* 旅行當天每分鐘重算一次（正在打字或面板開著時不動） */
setInterval(function(){if(G||liveIdx()<0||sh||whatIf!=null)return;
  if((tab==='now'||tab==='plan')&&!(document.activeElement&&/TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName))){render();autoLocate()}},60000);
/* 離線備援 */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){try{navigator.serviceWorker.register('sw.js').catch(function(){})}catch(e){}}
window.__trip={vm:function(){return vmOf(cur)},S:function(){return S}};
/* 液態玻璃按鈕：放開時像果凍回彈一下；Android 按下時輕震 */
(function(){var LQS='.pb,.tile,.gb,.gb2,.chip,.ib,.pvw,.wxb,.bind,.mini,.askbar,.opt';
  document.addEventListener('pointerup',function(e){if(calm||!document.body.classList.contains('glgl'))return;var t=e.target.closest&&e.target.closest(LQS);if(!t)return;
    t.classList.remove('jel');void t.offsetWidth;t.classList.add('jel');setTimeout(function(){t.classList.remove('jel')},520)},true);
  document.addEventListener('pointerdown',function(e){var t=e.target.closest&&e.target.closest(LQS);if(t)vib(6)},true);
  /* 打開 app 的第一秒：天空先出現，玻璃一片片浮上來（只有這一次） */
  if(!calm&&document.body.classList.contains('glgl')){document.body.classList.add('intro');
    [].forEach.call(document.querySelectorAll('#app .dial,#app .panel,#app .tile,#app .tonight,#app .strip,#app .askbar,#app .bind,#app .pb,#app .gb,#app .pv,#app .pvw,#app .wxb,#app .menu,#app .lmp,#tabs'),function(el,n){el.style.setProperty('--k',Math.min(n,10))});
    setTimeout(function(){document.body.classList.remove('intro')},1500)}})();
})();

