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
  /* 怎麼搭、路線圖（11/28）：路段的 board（怎麼搭）、stops（中間停的站）、line（路線名）、color（路線顏色）；
     某一班不一樣時寫在那一班的第 4 格 {board,stops,...}，蓋過路段的。沒有就不加 ex */
  function ex(L,R,h){var x=R&&R[3]&&typeof R[3]==='object'?R[3]:{};['board','stops','line','color'].forEach(function(k){var v=x[k]!=null?x[k]:L[k];if(v!=null)(h.ex=h.ex||{})[k]=v});return h}
  function hop(L,t){
    /* 固定間隔的車：freq:{first,last,every,ride}（首班、末班、幾分鐘一班、車程） */
    if(L.freq){var F=L.freq,f0=hm(F.first),f1=hm(F.last),d=t<=f0?f0:f0+Math.ceil((t-f0)/F.every)*F.every;if(d>f1)return null;
      return ex(L,null,{dep:d,arr:d+F.ride,how:L.name||'車',wait:d-t,last:d+F.every>f1,est:!!L.est,freq:1})}
    if(L.walk!=null)return ex(L,null,{dep:t,arr:t+L.walk,how:(L.name?L.name+' 約 ':'走路 ')+L.walk+' 分',est:!!L.est,walk:1});
    for(var i=0;i<L.runs.length;i++){var d=hm(L.runs[i][0]);if(d>=t)return ex(L,L.runs[i],{dep:d,arr:hm(L.runs[i][1]),how:L.runs[i][2],wait:d-t,last:i===L.runs.length-1&&!L.partial,est:!!L.est,fixed:!!L.fixed})}
    return null}
  /* 正在搭的那一班（路線圖用，11/28）：a→b、現在已經在車上，找發車時間 ≤ now 的最後一班 */
  function onboard(a,b,now){var e=(EDGES[a]||[]).filter(function(x){return x.to===b})[0],L=e&&e.L,h=null;if(!L)return null;
    if(L.runs){for(var i=L.runs.length-1;i>=0&&!h;i--){var d=hm(L.runs[i][0]);if(d<=now)h=ex(L,L.runs[i],{dep:d,arr:hm(L.runs[i][1]),how:L.runs[i][2],est:!!L.est,fixed:!!L.fixed})}}
    else if(L.freq){var F=L.freq,f0=hm(F.first),d0=f0+Math.floor(Math.max(0,now-f0)/F.every)*F.every;h=ex(L,null,{dep:d0,arr:d0+F.ride,how:L.name||'車',est:!!L.est,freq:1})}
    else h=ex(L,null,{dep:now,arr:now+L.walk,how:(L.name?L.name+' 約 ':'走路 ')+L.walk+' 分',est:!!L.est,walk:1});
    if(h){h.from=a;h.to=b}return h}
  /* a→b 這段路 t 之後的第一班（人在車站等車時，畫面說「下一班怎麼搭」用） */
  function hopAt(a,b,t){var e=(EDGES[a]||[]).filter(function(x){return x.to===b})[0],h=e?hop(e.L,t):null;if(h){h.from=a;h.to=b}return h}
  /* 兩地之間最早到的走法（可以經過別的地方轉）。班表不完整或沒有路段時回 unknown，不猜 */
  /* 不看時間，每個地點到 b 最少要幾段（說明「為什麼到不了」時，用最靠近 b 的那段斷掉的路來講） */
  function hopsTo(b){var D={},Q=[b];D[b]=0;while(Q.length){var v=Q.shift();Object.keys(EDGES).forEach(function(u){EDGES[u].forEach(function(e){if(e.to===v&&D[u]==null){D[u]=D[v]+1;Q.push(u)}})})}return D}
  function route(a,b,t){var best={},prev={},Q=[a],gap=null,gd=1e9,HB=hopsTo(b);best[a]=t;
    while(Q.length){Q.sort(function(x,y){return best[x]-best[y]});var u=Q.shift();if(u===b)break;
      (EDGES[u]||[]).forEach(function(e){var h=hop(e.L,best[u]);if(!h){var dd=HB[e.to]!=null?HB[e.to]:1e8;if(dd>=gd)return;gd=dd;
          /* 11/23：從土庄港回不了高松時，原本用第一個碰到的斷路（往草壁的巴士）說「沒有完整班次資料」；改用最靠近目的地的那段（渡輪：今天沒有了） */
          if(e.L.partial)gap={partial:1,name:e.L.name};else if(e.L.complete||e.L.freq)gap={none:1,name:e.L.name,fixed:e.L.fixed};else gap={partial:0,name:e.L.name,missed:e.L.fixed?e.L.name:null};return}
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
      var stay=here?0:((st.cut[it.id]||(o.cut&&o.cut[it.id]))&&it.min!=null?it.min:(it.stay||0)),lv=t+stay+(here?0:(st.ext[it.id]||0)+((o.ext&&o.ext[it.id])||0));
      if(it.hold)lv=Math.max(lv,hm(it.hold));
      if(here&&o.leaveAt!=null)lv=Math.max(lv,o.leaveAt);
      r.leave=lv;t=lv;p=it.place;rows.push(r)});
    return {rows:rows,issues:issues,unknown:unknown,end:t}}
  function ok(pl){return !pl.issues.length&&!pl.unknown}
  /* 只有牆和必經會擋路。可選的去不了就自動放掉，回報放掉了誰 */
  /* 11/24：放掉可選的之前，先把它的停留縮到最短（min）；縮了還不夠才放掉（模擬第 7 天：晚 1 分就整個放掉道後散步） */
  function hard(st,o){o=o||{};var drop={},self={},lost=[],own=[],cut={},short=[],k;for(k in (o.drop||{}))drop[k]=1;for(k in (o.cut||{}))cut[k]=1;
    function softsBefore(id){var out=[];for(var n=0;n<ITEMS.length&&ITEMS[n].id!==id;n++){var x=ITEMS[n];if(x.kind==='soft'&&!st.done[x.id]&&!st.drop[x.id]&&!drop[x.id]&&x.id!==st.here)out.push(x)}return out.sort(function(a,b){return (b.rank||0)-(a.rank||0)})}
    var ext2={};function run(d){var oo={};for(var q in o)oo[q]=o[q];oo.drop=d;oo.cut=cut;oo.ext=ext2;return plan(st,oo)}
    function canCut(x){return x.min!=null&&x.stay!=null&&x.min<x.stay&&!cut[x.id]&&!st.cut[x.id]}
    for(var guard=0;guard<16;guard++){var pl=run(drop);
      if(ok(pl)){/* 縮短的景點：只縮到剛好來得及（每次加回 5 分，加到不行為止） */
        short.forEach(function(x){var room=(x.stay||0)-x.min;while(room>=5){ext2[x.id]=(ext2[x.id]||0)+5;if(!ok(run(drop))){ext2[x.id]-=5;break}room-=5}});
        return {pl:run(drop),lost:lost,short:short.map(function(x){return {it:x,stay:x.min+(ext2[x.id]||0)}})}}
      /* 下一段是預約的車（fixed）或末班，待太久就搭不到：先縮短出發那一站的可選景點，再考慮放掉
         （11/28 第 3 天：山六醬油照原訂待 50 分，趕不上 14:45 預約的計程車，原本直接說山六醬油、橄欖公園都去不了） */
      if(!pl.issues.length&&pl.unknown&&(pl.unknown.dead||pl.unknown.missed)){var lr=pl.rows[pl.rows.length-1],px=lr&&lr.it;
        if(px&&px.kind==='soft'&&px.id!==st.here&&px.place===pl.unknown.from&&canCut(px)){cut[px.id]=1;short.push(px);continue}}
      var bad=pl.issues.length?pl.issues[0].it:pl.unknown.it;
      if(bad.kind==='soft'&&bad.id!==st.here){drop[bad.id]=1;self[bad.id]=1;lost.push(bad);own.push(bad);continue}
      var c=softsBefore(bad.id),cc=c.filter(canCut);
      if(cc.length&&pl.issues.length){cut[cc[0].id]=1;short.push(cc[0]);continue}
      if(!c.length){/* 放掉可選的也救不了：只回報本身去不了的，其他照原計畫 */
        var d2={};for(k in (o.drop||{}))d2[k]=1;for(k in self)d2[k]=1;var p2=run(d2);
        return {pl:p2,lost:own,short:short.map(function(x){return {it:x,stay:x.min}}),fail:p2.issues.length?p2.issues[0]:null,gap:p2.issues.length?null:p2.unknown}}
      drop[c[0].id]=1;lost.push(c[0])}
    return {pl:run(o.drop||{}),lost:own,short:short.map(function(x){return {it:x,stay:x.min}}),fail:{it:ITEMS[0],why:'排不出來'}}}
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
  return {plan:plan,hard:hard,limits:limits,latest:latest,relax:relax,brief:brief,early:early,goto:goto,stayUntil:stayUntil,ok:ok,onboard:onboard,hopAt:hopAt}}
/* L1 自動判斷位置：用定位＋時間判斷人在哪。純函式，app 和 node 測試共用。
   D＝套用開關後的那一天；o＝{now 分鐘, gps:{ll:[緯,經],acc 公尺,age 秒}｜null, fix 使用者的修正 {at,here,t}｜null,
     prev 上次判斷的結果｜null, done/drop/back：{項目id:1}（back＝使用者按了「加回來」）, P：Planner(D)（可省）}
   回傳 {at, here, t, arrT, passed[], src, far, d, anchor}
     src：gps 在某個地點的範圍內／near 離最近的地點 1.5 公里內／time 照時間推估／user 照使用者的修正
     t：給引擎的出發時間（在某地＝現在；near＝現在＋走過去；照時間推估、在路上＝從上一站出發的時間）
     far：離最近的地點多遠（公尺，不在任何地點範圍內才有）；nearP：照時間推估但有定位時，最近的地點；anchor：上一次確定的點（gps／user），下次照時間推估從這裡算
     passed：行程順序排在現在位置前面、還沒去的項目（引擎當作去過）。照時間推估時，起點那一項（確定在那裡過）不算在內 */
var GPS_AGE=120,GPS_ACC=1000,R_DEF=200,R_MAX=500,NEAR=1500,WALK=70,LEAVE_PAD=150,FIX_PAD=300,ROUTE=1000;
/* 點 p 到線段 a–b 的距離（公尺，小範圍用平面近似） */
function segDist(p,a,b){return segProj(p,a,b).d}
/* 同上，另外回傳投影在線段上的位置 t（0＝起點、1＝終點；raw 是沒夾在 0～1 的值） */
function segProj(p,a,b){var k=Math.cos(p[0]*Math.PI/180),X=function(q){return [(q[1]-p[1])*111320*k,(q[0]-p[0])*110540]},A=X(a),B=X(b),dx=B[0]-A[0],dy=B[1]-A[1],L=dx*dx+dy*dy,raw=L?-(A[0]*dx+A[1]*dy)/L:0,t=Math.max(0,Math.min(1,raw));
  return {d:Math.sqrt(Math.pow(A[0]+t*dx,2)+Math.pow(A[1]+t*dy,2)),t:t,raw:raw}}
function dist(a,b){var R=6371000,r=Math.PI/180,d1=(b[0]-a[0])*r,d2=(b[1]-a[1])*r,
  h=Math.sin(d1/2)*Math.sin(d1/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(d2/2)*Math.sin(d2/2);return 2*R*Math.asin(Math.sqrt(h))}
function judge(D,o){var P=o.P||Planner(D),now=o.now,L2=D.ll2||{},RAD=D.rad||{},IT=D.items,done=o.done||{},drop=o.drop||{},back=o.back||{};
  var g=o.gps&&o.gps.ll&&o.gps.age<=GPS_AGE&&o.gps.acc<=GPS_ACC?o.gps:null;
  function rng(p){return Math.min((RAD[p]||R_DEF)+(g?g.acc:0),R_MAX)}
  function dTo(p){return g&&L2[p]?dist(g.ll,L2[p]):Infinity}
  function open(id){return !done[id]&&!drop[id]}
  /* 這個地方有項目、而且都做完了（或不去了） */
  function idx(id){for(var n=0;n<IT.length;n++)if(IT[n].id===id)return n;return -1}
  function item(id){return IT[idx(id)]}
  function stayEnd(id,t){var it=item(id);if(!it)return t;var e=t+(it.stay||0);if(it.hold)e=Math.max(e,hm(it.hold));return e}
  /* 照原訂時間（當天出發點、預定出門）排一次：每個地點「計畫上什麼時候會在這裡、是為了去哪個項目」 */
  var base=null;function visits(p){if(!base)base=P.plan({at:D.startAt,t:hm(D.start),here:null,done:{},drop:{},cut:{},ext:{}});var V=[];
    if(p===D.startAt)V.push({t:hm(D.start),ri:0,start:1});
    base.rows.forEach(function(r){var n=idx(r.it.id);if(r.ride)r.ride.hops.forEach(function(h){if(h.from===p)V.push({t:h.dep,ri:n});if(h.to===p&&r.it.place!==p)V.push({t:h.arr,ri:n})});
      if(r.it.place===p)V.push({t:r.arr,ri:n,item:r.it.id})});return V}
  /* 人在地點 p：這裡有還沒去的項目 → here＝照順序第一個；出發點同時是最後一站（飯店）時，看時間比較接近出門還是回來 */
  function at(p){var c=IT.filter(function(x){return x.place===p&&open(x.id)}),V=visits(p),near=null;
    V.forEach(function(v){if(v.item&&!open(v.item))return;if(!near||Math.abs(v.t-now)<Math.abs(near.t-now))near=v});
    if(!c.length)return {here:null,ri:near?near.ri:-1};
    /* 同一個地點有好幾項（早上在松山站寄小包、下午回來拿；飯店早上退房、下午回來拿行李）：
       選計畫上「待在那裡的時間」最接近現在的那一項，不是永遠第一項（11/28 模擬：整天沒開 app、下午才第一次打開） */
    var hc=c[0].id,bd=1e9;base.rows.forEach(function(r){if(r.it.place!==p||!open(r.it.id))return;var d=now<r.arr?r.arr-now:now>r.leave?now-r.leave:0;if(d<bd){bd=d;hc=r.it.id}});
    /* 最接近的是「從這裡出門」：還沒出門，除非這一項就排在出門那時候（例如出發的飯店第一件事就是退房） */
    var r0=base.rows.filter(function(r){return r.it.id===hc})[0];
    if(near&&near.start){if(!(r0&&r0.arr<=hm(D.start)+5))return {here:null,ri:near.ri}}
    /* 最接近的是「從這裡搭車離開」或「在這裡轉車」（不是為了這裡的項目來的）：在等車，不是在這裡的項目，除非那一項就排在這時候前後。
       11/28 示範資料：出發點就是高松港、9:00 開船，8:50 在港口被當成在最後一站「回高松」（整天走完了），離開港口時又把它記成去過 */
    else if(near&&!near.item){if(!(r0&&near.t>=r0.arr-5&&near.t<=r0.leave+5))return {here:null,ri:near.ri}}
    return {here:hc,ri:idx(hc)}}
  function passed(ri){var out=[];for(var n=0;n<ri&&n<IT.length;n++){var id=IT[n].id;if(open(id)&&!back[id])out.push(id)}return out}
  function out(r,src,anchor){r.src=src;
    /* 還在出發點、還沒到預定出門時間：從預定出門時間開始排（不然半夜打開會排到首班車） */
    if(r.at===D.startAt&&!r.here&&r.t<hm(D.start)&&!passed(r.ri).length)r.t=hm(D.start);
    /* 照時間推估的起點那一項（上次定位確定在那裡）時間過了：算去過（went），不算走過（passed，不會問「還沒去」）。
       11/24 模擬：以前只從 passed 拿掉、沒記成去過，下一站沒座標時（參道、大步危峽遊船）會排回剛離開的景點 */
    var ps=passed(r.ri);r.went=ps.filter(function(id){return src==='time'&&anchor&&anchor.here===id});r.passed=ps.filter(function(id){return r.went.indexOf(id)<0});delete r.ri;if(r.arrT==null)r.arrT=r.t;
    r.anchor=anchor!==undefined?anchor:(src==='gps'||src==='user'?{at:r.at,here:r.here,t:r.here?r.arrT:r.t}:(o.prev&&o.prev.anchor)||null);return r}
  function keepArr(here){return o.prev&&o.prev.here===here&&o.prev.arrT!=null?o.prev.arrT:now}
  /* 1. 使用者的修正：有定位時離修正的地點超出範圍再多 300 公尺就失效；沒有定位時維持到那一項預定的停留時間結束 */
  /* fix.pick＝使用者在清單上點了一個地點：這裡有還沒去的項目就當作在那一項（跟定位同一條規則）；fix.left＝按了「走了」 */
  var F=o.fix,fh=null;if(F&&F.here&&!open(F.here))F=null;
  if(F){fh=F.here||(F.pick?at(F.at).here:null);var ok;if(g&&L2[F.at])ok=dTo(F.at)<=rng(F.at)+FIX_PAD;else ok=now<=(fh?stayEnd(fh,F.t):F.t);
    if(ok){var a1=at(F.at);return out({at:F.at,here:fh,t:fh||g?now:F.t,arrT:fh?F.t:null,ri:fh?idx(fh):a1.ri,d:g&&L2[F.at]?dTo(F.at):null},'user')}}
  if(g){/* 2. 在某個地點的範圍內（多個取最近）。已經判斷在 A：離開 A 要超出範圍再多 150 公尺 */
    var pv=o.prev&&(o.prev.src==='gps'||o.prev.src==='user')?o.prev.at:null,best=null,nr=null;
    /* 離開的緩衝（多 150 公尺）只給「這裡還有沒做完的項目」的地點：出發的飯店、車站不用撐著，不然走出 255 公尺還當你在飯店、算你趕不上車（11/24 模擬第 2 天） */
    Object.keys(D.places).forEach(function(p){var d=dTo(p);if(d===Infinity)return;if(!nr||d<nr.d)nr={p:p,d:d};
      var pad=p===pv&&o.prev&&o.prev.here&&open(o.prev.here)?LEAVE_PAD:0;
      if(d<=rng(p)+pad&&(!best||d<best.d))best={p:p,d:d}});
    /* 11/28 試過「路過已經去完的地方不算在那裡」（第 6 天臥龍山莊走去大洲城會經過おはなはん通り）：
       一律不算、只在兩站連線上才不算都試了，別天都亂掉——路過時被記成去過的地方，真的到了反而不認。
       「去過」的紀錄不夠可靠，這條規則先不做；第 6 天改用資料補おはなはん通り→大洲城直接走的路段 */
    if(best){var a2=at(best.p);return out({at:best.p,here:a2.here,t:now,arrT:a2.here?keepArr(a2.here):null,ri:a2.ri,d:best.d,far:0},'gps')}
    /* 3. 在某一段車程的路線附近（例如捷運坐到一半）：算在車上，往這段的終點。
       路線用起訖兩站的直線近似，離直線 ROUTE 公尺（加定位誤差）以內。
       離起站 1.5 公里內時（11/17 Ken 上班實驗：剛離開芝山被說成「正往芝山站」），要確定是已經上車、不是正走向起站才算：
       投影在起站「後面」（往終點那一側），而且上次判斷在起站、或照計畫已經到發車前 15 分 */
    /* 去程、回程常是同一條線（渡輪、纜車）：離線段一樣近，所以先看「上次判斷在哪一端」，再看照計畫現在最可能在搭哪一段（11/23 實測：去小豆島的船上被說成「往回高松」） */
    visits(D.startAt);var onR=null;base.rows.forEach(function(r){if(r.ride)r.ride.hops.forEach(function(h){if(h.walk||!L2[h.from]||!L2[h.to])return;
      var s=segProj(g.ll,L2[h.from],L2[h.to]);if(s.d>ROUTE+g.acc)return;
      var pr=o.prev&&o.prev.route,tdist=now<h.dep-15?h.dep-15-now:now>h.arr+15?now-h.arr-15:0;
      var score=(pr?(pr.from===h.from&&pr.to===h.to?0:pr.from===h.to&&pr.to===h.from?2000:1000):pv===h.from?0:pv===h.to?2000:1000)+tdist;
      if(!onR||score<onR.score||(score===onR.score&&s.d<onR.d))onR={from:h.from,to:h.to,d:s.d,t:s.t,raw:s.raw,dep:h.dep,arr:h.arr,ride:h.arr-h.dep,ri:idx(r.it.id),score:score}})});
    /* 在車上：引擎從「到終點站」排起（at＝終點站、t＝現在＋剩下的車程，照在路線上的位置比例估），不會再叫你去起站搭車 */
    /* 照班次搭的車、現在在那班車的時間內：用那班車的到站時間（11/24 模擬：用比例估多了 1 分，害寒霞溪之後的纜車趕不上） */
    function onRide(){var ta=now>=onR.dep&&now<=onR.arr?onR.arr:now+Math.max(1,Math.round((1-onR.t)*onR.ride));return out({at:onR.to,here:null,t:ta,ri:onR.ri,d:null,far:null,route:{from:onR.from,to:onR.to}},'gps')}
    if(onR&&nr&&nr.d<=NEAR&&onR.raw>0.02&&(pv===onR.from||(o.prev&&o.prev.route)||(now>=onR.dep-15&&now<=onR.arr+5)))return onRide();
    /* 4. 不在任何地點的範圍內：1.5 公里內當作正走過去。
       只認照計畫現在可能在、或接下來要去的地點（11/23 實測：搭計程車離開山六醬油，被說成「離草壁港 1.2 公里、往山六醬油」）；
       剛離開的地點和接下來要去的都在 1.5 公里內時，選要去的那個（從土庄港走去天使之路，不要說「離土庄港 1 公里」） */
    if(nr&&nr.d<=NEAR){var TN=timeEst().near,cands=Object.keys(D.places).filter(function(p){return TN[p]&&dTo(p)<=NEAR}).sort(function(a,b){return dTo(a)-dTo(b)});
      /* 剛離開的地點：上次是定位／修正就是那裡；上次已經是「正走向某處」就用它的起點（anchor）。上次正走向的地點還在候選裡就維持，不要來回跳 */
      var leftP=pv||(o.prev&&o.prev.anchor&&o.prev.anchor.at),keepP=o.prev&&o.prev.src==='near'&&cands.indexOf(o.prev.at)>=0?o.prev.at:null;
      var np=keepP||(cands.length>1&&cands[0]===leftP?cands[1]:cands[0]);
      if(np){var a3=at(np),dn=dTo(np);return out({at:np,here:null,t:now+Math.ceil(dn/WALK),ri:a3.here?idx(a3.here):a3.ri,d:dn,far:dn},'near')}}
    /* 5. 離每個地點都遠，但在路線附近：在車上 */
    if(onR)return onRide();
    var farD=nr?nr.d:null}
  /* 照時間推估：從上一次確定的點（沒有就是出發點、預定出門）照計畫往下走。回傳 {res, A, near:[照計畫現在可能在、或接下來要去的地點]} */
  function timeEst(){
  var A=(o.prev&&o.prev.anchor)||null;if(F&&(!A||F.t>=A.t))A={at:F.at,here:fh,t:F.t};
  var st={at:A?A.at:D.startAt,t:A?A.t:hm(D.start),here:A&&A.here&&open(A.here)?A.here:null,done:{},drop:{},cut:{},ext:{}},k;
  for(k in done)st.done[k]=1;for(k in drop)st.drop[k]=1;
  /* 起點是出發點、還沒到預定出門：照預定出門排（舊的「上次判斷」可能存了半夜的時間） */
  if(st.at===D.startAt&&!st.here&&st.t<hm(D.start)&&!Object.keys(st.done).length)st.t=hm(D.start);
  st.arrT=st.t;
  /* 起點前面還沒去的（那時候就算走過了）也當作去過，不然會排回頭 */
  if(A)passed(st.here?idx(st.here):at(st.at).ri).forEach(function(id){st.done[id]=1});
  var pl=P.hard(st,st.here?{leaveAt:stayEnd(st.here,st.t)}:{}).pl,pp=st.at,pt=st.t,res=null;
  for(var n=0;n<pl.rows.length&&!res;n++){var r=pl.rows[n];
    if(now<r.arr){/* 還沒到 r：如果第一段是車、還沒發車，人其實還在上一站等（上一站是景點就還算在那裡） */
      var h0=r.ride&&r.ride.hops[0],wait=h0&&!h0.walk&&now<h0.dep&&h0.from===pp,pr=n>0?pl.rows[n-1]:null;
      if(wait&&pr&&pr.it.place===pp)res={at:pp,here:pr.it.id,t:now,arrT:pr.arr,ri:idx(pr.it.id)};
      else res={at:pp,here:null,t:pt,ri:idx(r.it.id),wait:now<pt?1:0}}/* wait：還沒到出發時間，人還在上一站（例如還沒出門） */
    else if(now<=r.leave)res={at:r.it.place,here:r.it.id,t:now,arrT:r.arr,ri:idx(r.it.id)};
    pp=r.it.place;pt=r.leave}
  if(!res){var lastR=pl.rows[pl.rows.length-1];
    if(pl.unknown)res={at:pp,here:null,t:pt,ri:idx(pl.unknown.it.id)};
    else if(lastR&&lastR.it.id===IT[IT.length-1].id)res={at:lastR.it.place,here:lastR.it.id,t:now,arrT:lastR.arr,ri:idx(lastR.it.id)};
    else res={at:pp,here:null,t:pt,ri:IT.length}}
  /* 照計畫現在可能在、或接下來要去的地點：所在地點、下一兩段的地點，加上所在地點直接有路段能到的地方（晚出門、後面排不出來時也還知道「出了門會往港口走」） */
  var nearP={};nearP[res.at]=1;Object.keys(D.legs||{}).forEach(function(k){var ab=k.split('>');if(ab[0]===res.at)nearP[ab[1]]=1});for(var q=Math.max(0,n-1);q<=n&&q<pl.rows.length;q++){var rq=pl.rows[q];nearP[rq.it.place]=1;if(rq.ride)rq.ride.hops.forEach(function(h){nearP[h.from]=1;nearP[h.to]=1})}
  return {res:res,A:A,near:nearP}}
  var TE=timeEst(),res=TE.res,A=TE.A;
  res.far=farD!=null?farD:null;res.d=null;if(farD!=null)res.nearP=nr.p;
  return out(res,'time',A)}
/* 「還沒去 Y？」要不要問（L1，11/15 Fable 修正）：三個條件都成立才問，最多一個（照行程順序最前面的）
   1. 位置是確定的（gps／user）；照時間推估一律不問，當作照計畫去過了
   2. 現在早於原訂計畫離開 Y 的時間（照計畫這時候還不可能去完，比較可能是跳過了）
   3. Y 還排得進今天剩下的行程（排得出來、不會讓一定要去的趕不上）
   o＝{P, now, done, drop, cut, ext}（done 只放真的記過的，不含 passed） */
function askBack(D,o,J){if(!J||!(J.src==='gps'||J.src==='user')||!J.passed||!J.passed.length)return null;
  var P=o.P||Planner(D),IT=D.items,lv={},k;P.plan({at:D.startAt,t:hm(D.start),here:null,done:{},drop:{},cut:{},ext:{}}).rows.forEach(function(r){lv[r.it.id]=r.leave});
  for(var n=0;n<J.passed.length;n++){var id=J.passed[n],it=IT.filter(function(x){return x.id===id})[0];
    if(!it||it.kind==='soft'||lv[id]==null||!(o.now<lv[id]))continue;
    var st={at:J.at,t:J.t,here:J.here,arrT:J.arrT,done:{},drop:{},cut:o.cut||{},ext:o.ext||{}};
    for(k in (o.done||{}))st.done[k]=1;for(k in (o.drop||{}))st.drop[k]=1;J.passed.forEach(function(x){if(x!==id)st.done[x]=1});
    var H0=P.hard(st,{drop:(function(){var d={};d[id]=1;return d})()}),ids=IT.map(function(x){return x.id}).filter(function(x){return x!==id});
    for(var pos=0;pos<=ids.length;pos++){var o2=ids.slice();o2.splice(pos,0,id);var H=P.hard(st,{order:o2});
      if(!H.fail&&!(H.gap&&!H0.gap)&&!H.lost.some(function(x){return x.id===id}))return id}}
  return null}
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
return {Planner:Planner,state:state,hm:hm,fmt:fmt,prepare:prepare,judge:judge,askBack:askBack,dist:dist}})();
if(typeof module!=='undefined')module.exports=TripPlanner;
