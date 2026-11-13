var TripPlanner=(function(){
/* 旅遊助理：重排引擎
   每次都從「現在在哪、現在幾點」重新算，不記偏離了多少。
   牆 wall   = 必到而且有時間（錯過就沒了）
   必經 must = 必去但時間自由
   軟   soft = 可去可不去，rank 越大越先被丟
   路段 leg  = 兩地之間怎麼走：walk 分鐘，或 runs 班次（只能在發車時刻出發）
   資料裡沒有的路段，引擎會說「沒有資料」，不會猜。 */
function hm(s){var p=s.split(':');return +p[0]*60+ +p[1]}
function fmt(m){m=Math.round(m);return ('0'+Math.floor(m/60)%24).slice(-2)+':'+('0'+m%60).slice(-2)}
function dur(m){m=Math.round(m);return m<60?m+' 分':Math.floor(m/60)+' 小時'+(m%60?' '+m%60+' 分':'')}

function Planner(day){
  var ITEMS=day.items,LEGS=day.legs,P=day.places;
  var EDGES={};Object.keys(LEGS).forEach(function(k){var p=k.split('>');(EDGES[p[0]]=EDGES[p[0]]||[]).push({to:p[1],L:LEGS[k]})});
  function hop(L,t){
    /* 固定間隔的車：freq:{first,last,every,ride}（首班、末班、幾分鐘一班、車程） */
    if(L.freq){var F=L.freq,f0=hm(F.first),f1=hm(F.last),d=t<=f0?f0:f0+Math.ceil((t-f0)/F.every)*F.every;if(d>f1)return null;
      return {dep:d,arr:d+F.ride,how:L.name||'車',wait:d-t,last:d+F.every>f1,est:!!L.est,freq:1}}
    if(L.walk!=null)return {dep:t,arr:t+L.walk,how:(L.name?L.name+' 約 ':'走路 ')+L.walk+' 分',est:!!L.est,walk:1};
    for(var i=0;i<L.runs.length;i++){var d=hm(L.runs[i][0]);if(d>=t)return {dep:d,arr:hm(L.runs[i][1]),how:L.runs[i][2],wait:d-t,last:i===L.runs.length-1&&!L.partial,est:!!L.est,fixed:!!L.fixed}}
    return null}
  /* 兩地之間最早到的走法（可以經過別的地方轉）。班表不完整或沒有路段時回 unknown，不猜 */
  function route(a,b,t){var best={},prev={},Q=[a],gap=null;best[a]=t;
    while(Q.length){Q.sort(function(x,y){return best[x]-best[y]});var u=Q.shift();if(u===b)break;
      (EDGES[u]||[]).forEach(function(e){var h=hop(e.L,best[u]);if(!h){if(e.L.partial)gap=gap||{partial:1,name:e.L.name};else if(e.L.complete||e.L.freq)gap=gap||{none:1,name:e.L.name,fixed:e.L.fixed};else gap=gap||{partial:0,name:e.L.name,missed:e.L.fixed?e.L.name:null};return}
        if(best[e.to]==null||h.arr<best[e.to]){best[e.to]=h.arr;h.from=u;h.to=e.to;prev[e.to]=h;if(Q.indexOf(e.to)<0)Q.push(e.to)}})}
    if(best[b]==null)return gap&&gap.none?{none:1,name:gap.name,fixed:gap.fixed}:{unknown:1,partial:!!(gap&&gap.partial),missed:gap&&gap.missed};
    var hops=[],x=b;while(x!==a){hops.unshift(prev[x]);x=prev[x].from}
    return {hops:hops,arr:best[b],dep:hops[0].dep,how:hops[0].how,wait:hops[0].wait,last:hops[0].last,fixed:hops.some(function(h){return h.fixed}),est:hops.some(function(h){return h.est})}}
  /* 從狀態 st 把剩下的排一次。st.here = 已經到了的那一站。
     o.drop / o.cut / o.leaveAt（目前這站幾點走）/ o.order（改順序） */
  function plan(st,o){o=o||{};var t=st.t,p=st.at,rows=[],issues=[],unknown=null;
    var seq=(o.order||st.order||ITEMS.map(function(x){return x.id})).filter(function(id){return !st.done[id]&&!st.drop[id]&&!(o.drop&&o.drop[id])}).map(function(id){return ITEMS.filter(function(x){return x.id===id})[0]});
    seq.forEach(function(it,n){if(unknown)return;var r={it:it},here=n===0&&st.here===it.id;
      if(it.place!==p){var R=route(p,it.place,t);r.ride=R;r.from=p;
        if(R.unknown){unknown={it:it,from:p,partial:R.partial,missed:R.missed};return}
        if(R.none){issues.push({it:it,why:R.fixed?R.name+'的時間已經過了':'「'+R.name+'」今天沒有班次了',kind:'norun'});unknown={it:it,from:p,dead:1};return}
        t=R.arr}
      r.arr=t;
      if(!here){
        if(it.open&&t<hm(it.open)){r.waitOpen=hm(it.open)-t;t=hm(it.open)}
        if(it.at&&r.arr>hm(it.at))issues.push({it:it,why:'會晚 '+dur(r.arr-hm(it.at)),kind:'late'});
        if(it.close&&r.arr>hm(it.close))issues.push({it:it,why:'到的時候已經過了 '+it.close,kind:'closed'})}
      var stay=here?0:((st.cut[it.id]||(o.cut&&o.cut[it.id]))&&it.min!=null?it.min:(it.stay||0)),lv=t+stay+(here?0:(st.ext[it.id]||0));
      if(it.hold)lv=Math.max(lv,hm(it.hold));
      if(here&&o.leaveAt!=null)lv=Math.max(lv,o.leaveAt);
      r.leave=lv;t=lv;p=it.place;rows.push(r)});
    return {rows:rows,issues:issues,unknown:unknown,end:t}}
  function ok(pl){return !pl.issues.length&&!pl.unknown}
  /* 只有牆和必經會擋路。可選的去不了就自動放掉，回報放掉了誰 */
  function hard(st,o){o=o||{};var drop={},self={},lost=[],own=[],k;for(k in (o.drop||{}))drop[k]=1;
    function softsBefore(id){var out=[];for(var n=0;n<ITEMS.length&&ITEMS[n].id!==id;n++){var x=ITEMS[n];if(x.kind==='soft'&&!st.done[x.id]&&!st.drop[x.id]&&!drop[x.id]&&x.id!==st.here)out.push(x)}return out.sort(function(a,b){return (b.rank||0)-(a.rank||0)})}
    function run(d){var oo={};for(var q in o)oo[q]=o[q];oo.drop=d;return plan(st,oo)}
    for(var guard=0;guard<12;guard++){var pl=run(drop);
      if(ok(pl))return {pl:pl,lost:lost};
      var bad=pl.issues.length?pl.issues[0].it:pl.unknown.it;
      if(bad.kind==='soft'&&bad.id!==st.here){drop[bad.id]=1;self[bad.id]=1;lost.push(bad);own.push(bad);continue}
      var c=softsBefore(bad.id);
      if(!c.length){/* 放掉可選的也救不了：只回報本身去不了的，其他照原計畫 */
        var d2={};for(k in (o.drop||{}))d2[k]=1;for(k in self)d2[k]=1;var p2=run(d2);
        return {pl:p2,lost:own,fail:p2.issues.length?p2.issues[0]:null,gap:p2.issues.length?null:p2.unknown}}
      drop[c[0].id]=1;lost.push(c[0])}
    return {pl:run(o.drop||{}),lost:own,fail:{it:ITEMS[0],why:'排不出來'}}}
  /* 目前這站的期限：每個可選的「幾點前走才去得了」，以及牆的最後期限 */
  function limits(st){var out={soft:[],hard:null,gapAt:null},seen={},h0=hard(st);if(!st.here)return out;
    h0.lost.forEach(function(x){seen[x.id]=1});if(h0.fail||h0.gap)return out;var last=st.t;
    for(var x=st.t;x<=st.t+480;x+=5){var h=hard(st,{leaveAt:x});
      if(h.fail){out.hard={leave:last,why:h.fail};break}
      h.lost.forEach(function(it){if(!seen[it.id]){seen[it.id]=1;out.soft.push({it:it,leave:last})}});
      if(h.gap){out.gapAt={leave:last,gap:h.gap};break}
      last=x}
    return out}
  /* 目前這站最晚幾點走，以及是被誰卡住 */
  function latest(st){var base=plan(st);if(!st.here||!base.rows.length)return null;if(base.unknown)return {unknown:base.unknown};var last=null,why=null;
    for(var x=st.t;x<=st.t+480;x+=5){var pl=plan(st,{leaveAt:x});if(pl.issues.length>base.issues.length||(!base.unknown&&pl.unknown)){why=pl.issues[pl.issues.length-1]||{it:pl.unknown.it,why:'後面沒有班次資料'};break}last=x}
    return {leave:last,why:why,free:!why}}
  /* 不可行時照順序鬆弛：丟軟目標 → 壓短停留 → 都做。牆最後才動，而且只回報、不自動動 */
  function relax(st){var softs=ITEMS.filter(function(x){return x.kind==='soft'&&!st.done[x.id]&&!st.drop[x.id]}).sort(function(a,b){return (b.rank||0)-(a.rank||0)}),out=[];
    var cuts={};ITEMS.forEach(function(x){if(x.min!=null&&x.min<(x.stay||0)&&!st.done[x.id])cuts[x.id]=1});
    softs.forEach(function(s){var d={};d[s.id]=1;var pl=plan(st,{drop:d});if(ok(pl))out.push({say:'跳過「'+s.name+'」',drop:d,pl:pl})});
    var pc=plan(st,{cut:cuts});if(ok(pc))out.push({say:'每一站都壓到最短',cut:cuts,pl:pc});
    if(!out.length){var d2={};for(var i=0;i<softs.length;i++){d2[softs[i].id]=1;var p2=plan(st,{drop:d2,cut:cuts});if(ok(p2)){out.push({say:'跳過 '+Object.keys(d2).map(function(k){return '「'+ITEMS.filter(function(x){return x.id===k})[0].name+'」'}).join('')+'，其他壓到最短',drop:d2,cut:cuts,pl:p2});break}}}
    if(!out.length){out.fail=[];softs.forEach(function(sf){var d={};d[sf.id]=1;var pl=plan(st,{drop:d,cut:cuts});if(pl.unknown&&!pl.unknown.dead)out.fail.push('跳過「'+sf.name+'」的話，需要 '+P[pl.unknown.from]+' → '+P[pl.unknown.it.place]+' 的班表，資料裡沒有')})}
    return out}
  /* 現在要幹嘛：一段給人看的話 */
  function brief(st){var L=[],la=null,pl=plan(st),here=st.here&&pl.rows[0]?pl.rows[0]:null;
    L.push('【'+fmt(st.t)+'　在'+P[st.at]+'】');
    if(pl.issues.length){var is=pl.issues[0];L.push('▲ 照現在的排法：「'+is.it.name+'」'+is.why+(is.it.cons?'（'+is.it.cons+'）':''));
      var rx=relax(st);if(rx.length)rx.slice(0,3).forEach(function(r,i){L.push('　解法 '+(i+1)+'：'+r.say)});
      else{L.push('　用現有資料排不出解法。');(rx.fail||[]).forEach(function(f){L.push('　・'+f)});if(is.it.fallback)L.push('　備案：'+is.it.fallback)}return L.join('\n')}
    if(here){la=latest(st);
      if(!la||la.unknown){}else if(la.free)L.push('不用趕，後面沒有會卡住的。');
      else L.push('最晚 '+fmt(la.leave)+' 離開（還有 '+dur(la.leave-st.t)+'）。再晚：'+(la.why.kind?'「'+la.why.it.name+'」'+la.why.why:'搭不上已知的最後一班，之後的班次沒有資料'));}
    var plL=here&&la&&!la.unknown&&!la.free?plan(st,{leaveAt:la.leave}):pl,nx=here?plL.rows[1]:plL.rows[0],nx0=here?pl.rows[1]:null;
    if(nx){var R=nx.ride;L.push('下一步：'+(R?R.hops.map(function(h){return h.walk?h.how:fmt(h.dep)+' '+h.how+(h.last?'（最後一班）':'')}).join(' → ')+' → ':'')+nx.it.name+'，'+fmt(nx.arr)+' 到'+(R&&R.est?'（含估的時間）':''));
      if(nx0&&nx0.ride&&R&&nx0.ride.dep<R.dep&&!nx0.ride.hops[0].walk)L.push('　現在就走的話：搭 '+fmt(nx0.ride.dep)+' 那班，'+fmt(nx0.arr)+' 到')}
    var wall=null;pl.rows.forEach(function(r){if(!wall&&r!==here&&(r.it.kind==='wall'||(r.ride&&r.ride.fixed)))wall=r});
    if(wall){var fh=wall.ride&&wall.ride.hops.filter(function(h){return h.fixed})[0];L.push('下一道牆：'+(fh?fmt(fh.dep)+' '+fh.how:(wall.it.at?wall.it.at+' ':'')+wall.it.name))}
    if(pl.unknown){L.push('※ 算不出怎麼去「'+pl.unknown.it.name+'」：'+P[pl.unknown.from]+' → '+P[pl.unknown.it.place]+(pl.unknown.partial?' 的班表只填了一部分，已知的班次都過了':' 沒有路段資料'));if(pl.unknown.it.fallback)L.push('　備案：'+pl.unknown.it.fallback)}
    return L.join('\n')}
  /* 想提早走：多出來的時間會變成什麼，可以拿來做什麼 */
  function early(st){var it0=ITEMS.filter(function(x){return x.id===st.here})[0],base=plan(st,{leaveAt:st.arrT+(it0.stay||0)}),now=plan(st),L=[];
    var gain=base.rows[0].leave-st.t;if(gain<=0)return '已經到預計離開的時間了。';
    L.push('現在走，比原本早 '+dur(gain)+'。');
    var w=null;now.rows.forEach(function(r){if(w||!r.ride)return;r.ride.hops.forEach(function(h){if(!w&&h.wait>=15)w=h})});
    var homeB=base.rows[base.rows.length-1],homeN=now.rows[now.rows.length-1];
    if(!now.unknown&&!base.unknown&&homeN.arr<homeB.arr-5)L.push('・整天提早：最後 '+fmt(homeN.arr)+' 到'+P[homeN.it.place]+'（原本 '+fmt(homeB.arr)+'）');
    else if(w)L.push('・但車班不會變早：會在'+P[w.from]+'等 '+dur(w.wait)+'（'+fmt(w.dep)+' 的'+w.how+'）');
    Object.keys(st.drop).forEach(function(id){var s2=JSON.parse(JSON.stringify(st));delete s2.drop[id];var pl=plan(s2);if(ok(pl))L.push('・可以把剛剛跳過的「'+ITEMS.filter(function(x){return x.id===id})[0].name+'」加回來')});
    now.rows.slice(1).forEach(function(r){if(r.it.kind==='wall'||!r.it.stay)return;var s2=JSON.parse(JSON.stringify(st));s2.ext[r.it.id]=(s2.ext[r.it.id]||0)+Math.min(gain,60);if(ok(plan(s2)))L.push('・可以把時間挪給「'+r.it.name+'」多待 '+dur(Math.min(gain,60)))});
    return L.join('\n')}
  /* 現在想直接去某個地方（改順序），或直接回去 */
  function goto(st,id){var ids=ITEMS.map(function(x){return x.id}).filter(function(x){return x!==id});ids.unshift(id);var s3=JSON.parse(JSON.stringify(st)),lost=[];if(s3.here&&s3.here!==id){s3.done[s3.here]=1;s3.here=null}
    for(var q=0;q<ITEMS.length&&ITEMS[q].id!==id;q++)if(!s3.done[ITEMS[q].id]&&!s3.drop[ITEMS[q].id]){s3.drop[ITEMS[q].id]=1;lost.push(ITEMS[q])}
    var pl=plan(s3);
    var it=ITEMS.filter(function(x){return x.id===id})[0];
    if(pl.issues.length&&pl.issues[0].it.id===id&&pl.issues[0].kind==='norun')return '現在去「'+it.name+'」：'+pl.issues[0].why+'。';
    if(pl.unknown&&pl.unknown.it.id===id)return '現在去「'+it.name+'」：'+P[st.at]+' → '+P[it.place]+(pl.unknown.partial?' 的班表只填了一部分，算不出來。':' 沒有路段資料，算不出來。')+'這段要現場查。';
    var r=pl.rows[0],s='現在去「'+it.name+'」：'+(r.ride?r.ride.hops.map(function(h){return h.walk?h.how:fmt(h.dep)+' '+h.how}).join(' → ')+'，':'')+fmt(r.arr)+' 到。';
    if(pl.issues.length)s+='但「'+pl.issues[0].it.name+'」'+pl.issues[0].why+'。';else if(pl.unknown)s+='到了之後的行程算不出來（'+P[pl.unknown.from]+' → '+P[pl.unknown.it.place]+' 沒有資料）。';else if(pl.rows.length>1)s+='後面都來得及。';
    if(lost.length)s+='\n會略過：'+lost.map(function(x){return '「'+x.name+'」'+(x.kind!=='soft'?'（這站很重要，確定不去嗎？）':'')}).join('、');
    return s}
  /* 插一道臨時牆：我要在這裡待到幾點 */
  function stayUntil(st,t){var T=hm(t),pl=plan(st,{leaveAt:T});if(ok(pl))return '待到 '+t+' 可以。'+(pl.rows[1]&&pl.rows[1].ride?'之後搭 '+fmt(pl.rows[1].ride.dep)+' 的'+pl.rows[1].ride.how+'。':'');
    if(pl.issues.length){var s4=JSON.parse(JSON.stringify(st));s4.t=T;s4.done[st.here]=1;s4.here=null;var rx=relax(s4);return '待到 '+t+' 的話：「'+pl.issues[0].it.name+'」'+pl.issues[0].why+'。'+(rx.length?'要這樣做的話：'+rx[0].say+'。':'用現有資料排不出解法。'+((rx.fail||[])[0]||''))}
    return '待到 '+t+' 之後算不出來：'+P[pl.unknown.from]+' → '+P[pl.unknown.it.place]+(pl.unknown.partial?' 已知的班次都過了。':' 沒有資料。')}
  return {plan:plan,hard:hard,limits:limits,latest:latest,relax:relax,brief:brief,early:early,goto:goto,stayUntil:stayUntil,ok:ok}}
function state(at,t,here,arr){return {here:here||null,arrT:arr?hm(arr):hm(t),at:at,t:hm(t),done:{},drop:{},cut:{},ext:{},pick:{}}}
/* 套用行程開關：days 對調、項目／路段的 show 條件、走路路段自動雙向。app 和檢查工具共用這一份 */
function prepare(DAYS,SW,sw){function shown(x){if(!x||!x.show)return true;var p=x.show.split('=');return p[1].split('|').indexOf(sw[p[0]])>=0}
  /* 每天的 id（D1）：手機用它記進度，對調兩天時進度跟著那天的內容走。沒寫就用開關套用前的順序 d0、d1… */
  DAYS.forEach(function(D,k){if(D.id==null)D.id='d'+k});
  (SW||[]).forEach(function(s){if(s.days&&sw[s.k]===s.on){var a=s.days[0],b=s.days[1],t=DAYS[a];DAYS[a]=DAYS[b];DAYS[b]=t}});
  DAYS.forEach(function(D){
    D.items=D.items.filter(shown);if(D.miss)D.miss=D.miss.filter(shown);
    Object.keys(D.legs).forEach(function(k){var L=D.legs[k];
      if(Array.isArray(L)){L=L.filter(shown)[0];if(L)D.legs[k]=L;else delete D.legs[k]}
      else if(L.show&&!shown(L))delete D.legs[k]});
    Object.keys(D.legs).forEach(function(k){var L=D.legs[k],p=k.split('>'),r=p[1]+'>'+p[0];if((L.walk!=null||L.freq)&&!L.oneway&&!D.legs[r])D.legs[r]=L})});
  return DAYS}
return {Planner:Planner,state:state,hm:hm,fmt:fmt,prepare:prepare}})();
if(typeof module!=='undefined')module.exports=TripPlanner;
