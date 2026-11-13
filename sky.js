/* 天空玻璃：天空的世界。
   - 太陽、月亮的位置和月相用 SunCalc 依「行程地點＋當地時間」算出來。
   - 天色由太陽高度決定（不是看時鐘），雲量、雨、雪、霧、風照天氣。
   - 天空只反映真實的時間和天氣，不拿來表示「趕不趕」。
   - 只畫在一張全螢幕的畫布上；限 30 fps，背景時暫停，系統要求減少動態時只畫靜止的一張。
   對外：Sky.set({lat,lng,at:Date,wx:{cc,pr,code,ws}})、Sky.on(true/false)、Sky.hl() 取得玻璃高光要用的數值。 */
var Sky=(function(){
'use strict';
var mc,mg2,cv,ctx,drops,dctx,W=0,H=0,DPR=1,on=false,raf=0,last=0,calm=false,S={},stars=[],clouds=[],rain=[],glass=[],sprite={},spriteKey='';
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function lerp(a,b,t){return a+(b-a)*t}
function hex(h){return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)]}
function mixc(a,b,t){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]}
function rgb(c,a){return 'rgba('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+','+(a==null?1:a)+')'}
/* 太陽高度（度）→ 天頂色、地平線色 */
var PAL=[[-18,'#04060f','#0a1128'],[-12,'#070c22','#141f45'],[-7,'#101a40','#3a3566'],[-3,'#1d2b5c','#8a5876'],[0,'#2c437c','#e0866a'],
  [3,'#3a5f9e','#f3ad78'],[8,'#3a78bd','#cfe0ea'],[20,'#2a73c4','#a9d3ee'],[45,'#1e68c0','#93c8ee'],[90,'#1a62bc','#8cc4ee']];
function palette(alt){var a=PAL[0],b=PAL[PAL.length-1];
  for(var n=0;n<PAL.length-1;n++)if(alt>=PAL[n][0]&&alt<=PAL[n+1][0]){a=PAL[n];b=PAL[n+1];break}
  if(alt<PAL[0][0])b=a;var t=b===a?0:(alt-a[0])/(b[0]-a[0]);
  return {z:mixc(hex(a[1]),hex(b[1]),t),h:mixc(hex(a[2]),hex(b[2]),t)}}
var GREY_D=hex('#8a95a3'),GREY_N=hex('#1b2230');
/* 天氣代碼（WMO）→ 種類 */
function kind(w){var c=w.code||0;if(c>=95)return 'storm';if(c===45||c===48)return 'fog';if((c>=71&&c<=77)||c===85||c===86)return 'snow';if(c>=51||w.pr>0.2)return 'rain';return 'dry'}
function compute(p){var r={};
  var sp=SunCalc.getPosition(p.at,p.lat,p.lng),mp=SunCalc.getMoonPosition(p.at,p.lat,p.lng),mi=SunCalc.getMoonIllumination(p.at);
  r.sunAlt=sp.altitude*180/Math.PI;r.sunAz=sp.azimuth*180/Math.PI;r.moonAlt=mp.altitude*180/Math.PI;r.moonAz=mp.azimuth*180/Math.PI;
  r.moonFrac=mi.fraction;r.moonPhase=mi.phase;
  var w=p.wx||{cc:10,pr:0,code:0,ws:8};r.cc=clamp(w.cc||0,0,100)/100;r.pr=w.pr||0;r.ws=w.ws||0;r.kind=kind(w);
  var pal=palette(r.sunAlt),dark=clamp((-r.sunAlt+2)/14,0,1),grey=mixc(GREY_D,GREY_N,dark),g=r.cc*(r.kind==='rain'||r.kind==='storm'||r.kind==='snow'?.85:.55);
  if(r.kind==='fog')g=Math.max(g,.6);
  r.z=mixc(pal.z,grey,g);r.h=mixc(pal.h,grey,g*.9);
  if(r.kind==='rain'||r.kind==='storm')r.z=mixc(r.z,[20,26,36],r.kind==='storm'?.6:.25);if(r.kind==='storm')r.h=mixc(r.h,[30,36,46],.5);
  r.night=dark;r.golden=clamp(1-Math.abs(r.sunAlt-2)/8,0,1)*(1-r.cc*.7);
  return r}
/* ===== 畫法：WebGL2，三段
   1. 1×1 小圖：算太陽有沒有被雲遮住（整個畫面共用一個數）。
   2. 天空（低解析度貼圖＋mipmap）：大氣散射、雲、遠山、日月、霧。每秒 10～30 張就夠。
   3. 合成（手機原生解析度）：玻璃面板、液態玻璃按鈕、窗上的水滴和霜、星星、雨絲雪花。
      霧面＝讀貼圖的模糊層；液態玻璃＝讀清楚的層再折射。所以按鈕邊緣是清楚的，天空每個像素只算一次。
   天氣、時間都是緩動過去的（下雨慢慢下起來，雨停水滴留在窗上慢慢乾）。 */
var SWP=0,RIP={x:0,y:0,t:0,s:1},OPB=new Float32Array(24),FL={v:0,next:0},gl=null,GL_OK=false,PR={},RS=1,SR=.8,Q=0,sig='',clipC=new WeakMap(),radC=new WeakMap(),slow=0,lastT=0,lastSky=0,lastComp=0,A=null,T=null,jump=true;
var fbD,txD,DW=0,DH=0,fbS,txS,SW=0,SH=0,fbO,txO,wpc,wpx,wtex,wDirty=false,wAny=false,wLast=0,wN=0,wPrev=null,wDown=null,wMoved=false;
var LQ='.opt:not(.ghost),.pb,.tile,.gb,.gb2,.chip,.ib,.pvw,.wxb,.bind,.mini,.days button,.askbar,.opt.ghost,.stepper,.tel';
var GSEL='.dial,.opt:not(.ghost),.pb,.panel,.menu,.tile,.tonight,.strip,.askbar,.bind,.days button,.pv,.pvw,.wxb,.gb,.gb2,.opt.ghost,.chip,.ib,.mrow input,input[type=text],input[type=number],input[type=time],textarea,.stepper,.tel,.mini';
var SOLID='.chip.on,.days button.on,#sheet *,#tabs *';
var NMAX=24;
var VS='#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
var HEAD=['#version 300 es','precision highp float;','out vec4 o;',
'uniform vec2 uV;uniform float uS,uT,uCov,uRain,uSnow,uFog,uNight,uWind,uTilt,uLum,uMoonPh,uMoonV,uSunV;',
'uniform vec3 uSun,uMoon;uniform vec2 uSunP,uMoonP;uniform float uScape,uFlash;',
'float gOcc=1.;float gRip=0.;','const float PI=3.14159265;',
'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
'float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+1.),u.x),u.y);}',
'float fbm(vec2 p,int n){float a=.5,s=0.;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<6;i++){if(i>=n)break;s+=a*vn(p);p=m*p+vec2(3.1,1.7);a*=.5;}return s;}',
/* 螢幕位置（CSS px）→ 方向：寬度涵蓋 240° 方位（東在左），地平線在 80% 高 */
'vec3 dirAt(vec2 p){float az=(p.x/uV.x-.5)*150.*PI/180.;float hz=uV.y*.64;float al=clamp((hz-p.y)/hz*75.,-89.,89.)*PI/180.;return vec3(sin(az)*cos(al),sin(al),cos(az)*cos(al));}',
'float airm(float s){float d=max(degrees(asin(clamp(s,-1.,1.))),-1.);return 1./(max(sin(radians(d)),-0.0174)+.50572*pow(d+6.07995,-1.6364));}',
'const vec3 BR=vec3(.0464,.108,.265);const float BM=.021;const vec3 BO=vec3(.072,.168,.008);',
/* 太陽光穿過大氣後剩下的顏色 */
'vec3 sunT(){return exp(-(BR+BM*1.1+BO)*airm(uSun.y));}',
'vec3 atm(vec3 rd,vec3 ld,vec3 E,float g){float mu=dot(rd,ld);float pr=.75*(1.+mu*mu);float pm=(1.-g*g)/pow(1.+g*g-2.*g*mu,1.5)*.5;',
' vec3 ext=BR+BM*1.1;float mv=airm(max(rd.y,.0));vec3 lt=pow(exp(-(BR+BM*1.1+BO)*airm(ld.y)),vec3(.18));',
' return E*lt*(pr*BR+pm*BM*.45)*(1.-exp(-ext*mv))/ext;}',
'const float ES=4.;',
'float tw(float s){return smoothstep(-.31,.02,s);}',
'vec3 skyBase(vec3 rd){',
' float f=tw(uSun.y);vec3 c=atm(rd,uSun,vec3(ES),.76)*f;',
' float dusk=smoothstep(-.3,-.02,uSun.y)*(1.-smoothstep(-.02,.12,uSun.y));',
' c+=vec3(.04,.08,.22)*dusk*(1.-max(rd.y,0.)*.5);',
' c+=vec3(.006,.010,.024)+vec3(.010,.016,.034)*(1.-max(rd.y,0.));',
' c+=atm(rd,uMoon,vec3(.15),.8)*uMoonV*(1.-f);',
' float Lm=dot(c,vec3(.3,.59,.11));return max(Lm+(c-Lm)*1.35,0.);}',
''].join('\n');
var OCC_FS=HEAD+['','float sunOcc(){if(uSun.y<.004)return 1.;vec3 rd=uSun;float t=min(1./rd.y,45.);vec2 uv=rd.xz*t*.75+vec2(uT*uWind*.012,uT*.002);float w=fbm(uv*.6+3.,2);float d=fbm(uv+w*.8,4);float th=mix(.78,.22,uCov);return 1.-smoothstep(th,th+mix(.1,.3,uCov),d)*.92;}',
'void main(){o=vec4(sunOcc());}'].join('\n');
var SKY_FS=HEAD+['','uniform sampler2D uOcc;',
'vec4 cloud(vec3 rd,float lo,vec3 sunC,vec3 amb){',
' if(rd.y<.004)return vec4(0.);float t=min(1./rd.y,45.);vec2 uv=rd.xz*t*.75+vec2(uT*uWind*.012,uT*.002);',
' int oc=lo>.75?2:(lo>.25?4:6);float w=fbm(uv*.6+3.,2);float d=fbm(uv+w*.8,oc);',
' float th=mix(.78,.22,uCov);float den=smoothstep(th-lo*.12,th+mix(.08,.2,uCov)+lo*.35,d);',
' if(den<=0.)return vec4(0.);',
' vec2 sd=normalize(uSun.xz+1e-4)*.18;float d2=fbm(uv+w*.8+sd,lo>.75?2:4);float lit=clamp((d-d2)*5.+.55,0.,1.);',
' float mu=dot(rd,uSun);float fw=pow(max(mu,0.),6.)*(1.-den)*3.;',
' vec3 ab=mix(vec3(dot(amb,vec3(.3,.59,.11))),amb,.45);vec3 col=sunC*(.18+.82*lit)*(1.-uRain*.55)+ab*(.8+.25*lit)+sunC*fw*.6;',
' col+=vec3(.85,.9,1.)*uFlash*(1.2+lit);',
' col*=mix(1.,.55,uRain*den)*(1.-.45*smoothstep(.9,1.,uRain));',
' float fade=smoothstep(.0,.1+lo*.25,rd.y);return vec4(col,den*fade*mix(.92,1.,uCov));}',
'float ridge(float az,float k,float amp,float base){return base+amp*(fbm(vec2(az*k,k*7.),4)-.35);}',
'vec3 scene(vec2 p){float lo=0.;',
' vec3 rd=dirAt(p);vec3 c=skyBase(rd);',
' vec3 sunC=ES*sunT()*tw(uSun.y)*.5*mix(.45,1.,gOcc)+vec3(.02,.03,.06)*uMoonV*(1.-tw(uSun.y));',
' vec3 amb=skyBase(normalize(vec3(rd.x,.6,rd.z)))*.55;',
/* 太陽和月亮的圓盤（畫面上放大一點） */
/* 太陽：圓盤（接近地平線時壓扁、偏紅）＋兩層光暈 */
' vec2 dv=p-uSunP;dv.y/=mix(.72,1.,smoothstep(0.,.1,uSun.y));float ds=length(dv);float sv2=uSunV*gOcc;',
' c+=ES*sunT()*(6.*smoothstep(11.,7.,ds)+.9*exp(-ds/16.)+.25*exp(-ds/70.))*sv2;',
' vec2 q=(p-uMoonP)/14.;float mr=length(q);if(mr<1.2&&uMoon.y>-.02){vec3 n=vec3(q.x,-q.y,sqrt(max(1.-mr*mr,0.)));float an=uMoonPh*2.*PI;vec3 L=vec3(sin(an),0.,-cos(an));',
'  float lt=smoothstep(-.06,.12,dot(n,L));float ma=.78+.22*vn(q*2.6+5.)-.12*smoothstep(.45,.2,length(q-vec2(-.2,-.15)));',
'  float disc=smoothstep(1.,.9,mr);c+=vec3(1.,.97,.9)*.9*lt*ma*disc*(lo>.5?.4:1.)+vec3(.02,.025,.04)*disc*uNight;}',
/* 雲 */
/* 高空薄雲（卷雲）：比較亮、移動比較快，在積雲後面 */
' if(rd.y>.01&&uRain<.5){float t2=min(.55/rd.y,30.);vec2 u2=rd.xz*t2*.5+vec2(uT*uWind*.03,uT*.004);vec2 wq=u2*1.3;wq+=vec2(fbm(wq*.5+9.,3),fbm(wq*.5+2.,3))*1.6;float ci=fbm(wq+3.,4);',
'  float cd=smoothstep(.52,.86,ci)*smoothstep(.0,.18,rd.y)*clamp(uCov*1.6+.25,.25,.75);vec3 cc=sunC*.85+vec3(dot(amb,vec3(.3,.59,.11)))*.9;c=mix(c,cc,cd*.3*smoothstep(.04,.2,rd.y)*clamp((uCov-.12)*3.,0.,1.));}',
' vec4 cl=cloud(rd,lo,sunC,amb);c=mix(c,cl.rgb,cl.a);',
/* 雲縫透出的光束 */
' if(uCov>.15&&uCov<.97&&uSun.y>-.03&&lo<.75){vec2 v=p-uSunP;float an=atan(v.y,v.x);float rr=length(v)/uV.y;float ry=fbm(vec2(an*7.,uT*.03),3);float k=smoothstep(.42,.75,ry)*exp(-rr*1.6)*uCov*(1.-uCov)*4.*(1.-uRain);c+=sunT()*ES*.09*k*(1.-gOcc*.5);}',
/* 遠山（被空氣染成天色），近山（暗） */
' float az=atan(rd.x,rd.z);float al=degrees(asin(clamp(rd.y,-1.,1.)));vec3 hz=skyBase(normalize(vec3(rd.x,.02,rd.z)));',
' vec3 land=sunC*.08+amb*.3;',
' if(uScape<.5){',
/*  山：遠山被空氣染藍，近山暗 */
'  if(al<5.){float r1=ridge(az,2.2,3.2,1.1);if(al<r1)c=mix(land,hz,.5);',
'  float r2=ridge(az+2.,3.7,2.6,-.2);if(al<r2)c=mix(land*.5,hz,.22-.16*smoothstep(0.,-10.,al));}',
' }else if(uScape<1.5){',
/*  海：遠方島影，海面反射天空、有細浪，太陽或月亮下方有一條反光帶 */
'  if(al<3.){float r1=ridge(az,1.6,3.,-.4)*smoothstep(.25,.6,fbm(vec2(az*1.1,3.),2));if(al<r1&&al>-.05)c=mix(land,hz,.55);}',
'  if(al<0.){float dd=1./max(-rd.y,.004);vec2 wp=rd.xz*dd;float wv=fbm(wp*vec2(1.,3.)*.9+vec2(uT*.04,0.),4)-.5;',
'   vec3 rf=normalize(vec3(rd.x+wv*.04,-rd.y+wv*.06,rd.z));vec3 sk=skyBase(rf);float fr=.04+.96*pow(1.-max(-rd.y,0.),5.);',
'   vec3 wcol=mix(vec3(.004,.02,.03)+amb*.05,sk*.85,fr*.9);',
'   float sa=atan(uSun.x,uSun.z);float da=abs(az-sa);float col_w=.02+.03*dd/(dd+30.);',
'   float gl=smoothstep(.62,.95,vn(wp*vec2(2.6,7.)+vec2(uT*.35,uT*.18)))*.55*smoothstep(col_w*4.,0.,da)*(1.-uCov*.8)*uSunV*gOcc;',
'   wcol+=sunT()*ES*gl*2.2;',
'   float ma=atan(uMoon.x,uMoon.z);float dm2=abs(az-ma);float glm=smoothstep(.62,.95,vn(wp*vec2(2.6,7.)+vec2(uT*.35,uT*.18)+7.))*.55*smoothstep(.08,0.,dm2)*uMoonV*step(0.,uMoon.y);',
'   wcol+=vec3(.9,.92,1.)*glm*.9;',
'   c=mix(wcol,hz,smoothstep(-.6,0.,al)*.7);}',
' }else{',
/*  城市：遠山＋天際線，晚上窗戶亮燈 */
'  if(al<5.){float r1=ridge(az,2.2,2.,1.4);if(al<r1)c=mix(land,hz,.55);',
'   float bx=floor(az*90.);float bh=h21(vec2(bx,3.));float hgt=.2+pow(bh,3.)*2.4*smoothstep(.1,.5,vn(vec2(az*6.,1.)));',
'   if(al<hgt){c=mix(land*.55,hz,.3);float wx=fract(az*90.);float wy=al*14.;vec2 wi=vec2(floor(az*360.),floor(wy));',
'    float lit=step(.62,h21(wi+bx))*step(.12,fract(az*360.))*step(.2,fract(wy));c+=vec3(1.,.78,.45)*lit*uNight*.35;}',
'   if(al<0.){c=mix(land*.4,hz,.15);vec2 g=vec2(floor(az*240.),floor(al*20.));float l=step(.93,h21(g));c+=vec3(1.,.8,.5)*l*uNight*.5*smoothstep(-6.,0.,al);}}',
' }',
/* 霧、雨天整片灰 */
' c+=vec3(.5,.55,.65)*uFlash*.35;vec3 fg=hz*.9+vec3(.03);c=mix(c,fg,uFog*(.55+.45*(1.-smoothstep(0.,.45,rd.y))));',
' float L=dot(c,vec3(.3,.59,.11));c=mix(c,vec3(L)*vec3(.95,.98,1.04),uRain*.6);',
' return c;}',
'void main(){vec2 p=vec2(gl_FragCoord.x,uV.y*uS-gl_FragCoord.y)/uS;gOcc=texelFetch(uOcc,ivec2(0),0).r;',
' vec3 c=scene(p);c=1.-exp(-c*1.1);o=vec4(pow(c,vec3(1./1.9)),1.);}'].join('\n');
var DROP_FS=HEAD+['','uniform vec3 uDL;uniform sampler2D uWp;',
'float rainL(vec2 p,float sc,float sp){p.x+=p.y*uTilt;float cx=floor(p.x/sc);float h=h21(vec2(cx,sc));if(h<.55)return 0.;float y=fract(p.y/(sc*22.)-uT*sp*(.7+h)+h*9.);float x=abs(fract(p.x/sc)-.5)*sc;return smoothstep(.85,0.,x)*smoothstep(0.,.05,y)*(1.-smoothstep(.05,.28,y));}',
'float snowL(vec2 p,float sc,float sp){p.y-=uT*sp;p.x+=sin(p.y/sc*.7+uT)*sc*.2+uT*uTilt*sc*.4;vec2 g=floor(p/sc);float h=h21(g);if(h<.5)return 0.;vec2 c=(g+.2+.6*vec2(h21(g+3.),h21(g+5.)))*sc;return smoothstep(sc*.09,sc*.03,length(p-c));}',
'float sdRB(vec2 q,vec2 b,float r){vec2 d=abs(q)-b+r;return length(max(d,0.))+min(max(d.x,d.y),0.)-r;}',
/* ---- 窗上的雨滴（參考 BigWings「Heartfelt」的做法）：大水滴往下滑、留下水痕、小水珠 ---- */
'vec3 N13(float p){vec3 p3=fract(vec3(p)*vec3(.1031,.11369,.13787));p3+=dot(p3,p3.yzx+19.19);return fract(vec3((p3.x+p3.y)*p3.z,(p3.x+p3.z)*p3.y,(p3.y+p3.z)*p3.x));}',
'float N1(float t){return fract(sin(t*12345.564)*7658.76);}',
'float Saw(float b,float t){return smoothstep(0.,b,t)*smoothstep(1.,b,t);}',
'vec2 DropL(vec2 uv,float t){vec2 UV=uv;uv.y+=t*.75;vec2 a=vec2(6.,1.);vec2 gr=a*2.;vec2 id=floor(uv*gr);uv.y+=N1(id.x);id=floor(uv*gr);',
' vec3 n=N13(id.x*35.2+id.y*2376.1);vec2 st=fract(uv*gr)-vec2(.5,0.);float x=n.x-.5;float y=UV.y*20.;float wg=sin(y+sin(y));x+=wg*(.5-abs(x))*(n.z-.5);x*=.7;',
' float ti=fract(t+n.z);y=(Saw(.85,ti)-.5)*.9+.5;vec2 pp=vec2(x,y);float d=length((st-pp)*a.yx);float md=smoothstep(.4,0.,d);',
' float r=sqrt(smoothstep(1.,y,st.y));float cd=abs(st.x-x);float tr=smoothstep(.23*r,.15*r*r,cd);float tf=smoothstep(-.02,.02,st.y-y);tr*=tf*r*r;',
' y=UV.y;y=fract(y*10.)+(st.y-.5);float dd=length(st-vec2(x,y));float dl=smoothstep(.3,0.,dd);return vec2(md+dl*r*tf,tr);}',
'float StaticD(vec2 uv,float t){uv*=40.;vec2 id=floor(uv);uv=fract(uv)-.5;vec3 n=N13(id.x*107.45+id.y*3543.654);vec2 pp=(n.xy-.5)*.7;float d=length(uv-pp);float f=Saw(.025,fract(t+n.z));return smoothstep(.3,0.,d)*fract(n.z*10.)*f;}',
'vec2 Drops(vec2 uv,float t,float l0,float l1,float l2){float s=StaticD(uv,t)*l0;vec2 m1=DropL(uv,t)*l1;vec2 m2=DropL(uv*1.85,t)*l2;float c=s+m1.x+m2.x;c=smoothstep(.3,1.,c);return vec2(c,max(m1.y*l0,m2.y*l1));}',
'void main(){vec2 p=vec2(gl_FragCoord.x,uV.y*uS-gl_FragCoord.y)/uS;float wp=texture(uWp,p/uV).r;vec2 uv=vec2(p.x,uV.y-p.y)/520.;float t=uT*.18;float l0=uDL.x*(1.-wp);uv.x+=uv.y*uTilt*.5;',
' vec2 c=Drops(uv,t,l0,uDL.y,uDL.z);vec2 e=vec2(.0016,0.);float cx=Drops(uv+e,t,l0,uDL.y,uDL.z).x;float cy=Drops(uv+e.yx,t,l0,uDL.y,uDL.z).x;',
' o=vec4(clamp(vec2(cx-c.x,-(cy-c.x))*2.+.5,0.,1.),c.x,c.y);}'].join('\n');
var COMP_FS=HEAD+['',
'uniform int uN;uniform vec4 uR[24];uniform vec4 uC[24];uniform float uRad[24];uniform vec4 uK[24];uniform float uWet,uMist,uFrost,uSR,uDay,uGy,uSwp;uniform float uOp[24];uniform vec4 uRip;uniform vec3 uDL;',
'uniform sampler2D uSky,uOcc,uWp,uDr;',
'vec3 dec(vec3 v){v=min(pow(v,vec3(1.9)),vec3(.995));return -log(1.-v)/1.1;}',
'vec2 tuv(vec2 p){return vec2(p.x/uV.x,1.-p.y/uV.y);}',
'vec3 skyAt(vec2 p,float lod){p.x+=uGy*14.;return dec(textureLod(uSky,tuv(p),lod).rgb);}',
/* 霧面：讀模糊層，再五點平均，邊緣不會有方格 */
'vec3 skyF(vec2 p){p.x+=uGy*14.;float L=mix(3.2,2.1,uDay);vec3 s=textureLod(uSky,tuv(p),L).rgb*.32;float d=mix(14.,8.,uDay);',
' s+=textureLod(uSky,tuv(p+vec2(d,d*.6)),L+.2).rgb*.17+textureLod(uSky,tuv(p+vec2(-d,d*.6)),L+.2).rgb*.17+textureLod(uSky,tuv(p+vec2(d*.6,-d)),L+.2).rgb*.17+textureLod(uSky,tuv(p+vec2(-d*.6,-d)),L+.2).rgb*.17;return dec(s);}',
/* 星星：在合成這一段畫，才會是清楚的一點 */
'float hzY(){return uV.y*.64;}',
'vec3 stars(vec2 p){float sv=(1.-tw(uSun.y+.12))*(1.-uCov*.95)*(1.-uFog);if(sv<.01||p.y>hzY()-6.)return vec3(0.);',
' vec2 g=floor(p/3.);float h=h21(g);if(h<=.982)return vec3(0.);vec2 cc=(g+.5+.3*vec2(h21(g+7.),h21(g+9.))-.15)*3.;float r=length(p-cc);float b=(h-.982)/.018;',
' return vec3(.9,.95,1.)*sv*b*smoothstep(1.4,0.,r)*(.6+.4*sin(uT*(1.+h*4.)+h*40.))*.9;}',
'float rainL(vec2 p,float sc,float sp){p.x+=p.y*uTilt;float cx=floor(p.x/sc);float h=h21(vec2(cx,sc));if(h<.55)return 0.;float y=fract(p.y/(sc*22.)-uT*sp*(.7+h)+h*9.);float x=abs(fract(p.x/sc)-.5)*sc;return smoothstep(.85,0.,x)*smoothstep(0.,.05,y)*(1.-smoothstep(.05,.28,y));}',
'float snowL(vec2 p,float sc,float sp){p.y-=uT*sp;p.x+=sin(p.y/sc*.7+uT)*sc*.2+uT*uTilt*sc*.4;vec2 g=floor(p/sc);float h=h21(g);if(h<.5)return 0.;vec2 c=(g+.2+.6*vec2(h21(g+3.),h21(g+5.)))*sc;return smoothstep(sc*.09,sc*.03,length(p-c));}',
'float sdRB(vec2 q,vec2 b,float r){vec2 d=abs(q)-b+r;return length(max(d,0.))+min(max(d.x,d.y),0.)-r;}',
/* ---- 窗上的雨滴（參考 BigWings「Heartfelt」的做法）：大水滴往下滑、留下水痕、小水珠 ---- */
'vec3 N13(float p){vec3 p3=fract(vec3(p)*vec3(.1031,.11369,.13787));p3+=dot(p3,p3.yzx+19.19);return fract(vec3((p3.x+p3.y)*p3.z,(p3.x+p3.z)*p3.y,(p3.y+p3.z)*p3.x));}',
'float N1(float t){return fract(sin(t*12345.564)*7658.76);}',
'float Saw(float b,float t){return smoothstep(0.,b,t)*smoothstep(1.,b,t);}',
'vec2 DropL(vec2 uv,float t){vec2 UV=uv;uv.y+=t*.75;vec2 a=vec2(6.,1.);vec2 gr=a*2.;vec2 id=floor(uv*gr);uv.y+=N1(id.x);id=floor(uv*gr);',
' vec3 n=N13(id.x*35.2+id.y*2376.1);vec2 st=fract(uv*gr)-vec2(.5,0.);float x=n.x-.5;float y=UV.y*20.;float wg=sin(y+sin(y));x+=wg*(.5-abs(x))*(n.z-.5);x*=.7;',
' float ti=fract(t+n.z);y=(Saw(.85,ti)-.5)*.9+.5;vec2 pp=vec2(x,y);float d=length((st-pp)*a.yx);float md=smoothstep(.4,0.,d);',
' float r=sqrt(smoothstep(1.,y,st.y));float cd=abs(st.x-x);float tr=smoothstep(.23*r,.15*r*r,cd);float tf=smoothstep(-.02,.02,st.y-y);tr*=tf*r*r;',
' y=UV.y;y=fract(y*10.)+(st.y-.5);float dd=length(st-vec2(x,y));float dl=smoothstep(.3,0.,dd);return vec2(md+dl*r*tf,tr);}',
'float StaticD(vec2 uv,float t){uv*=40.;vec2 id=floor(uv);uv=fract(uv)-.5;vec3 n=N13(id.x*107.45+id.y*3543.654);vec2 pp=(n.xy-.5)*.7;float d=length(uv-pp);float f=Saw(.025,fract(t+n.z));return smoothstep(.3,0.,d)*fract(n.z*10.)*f;}',
'vec2 Drops(vec2 uv,float t,float l0,float l1,float l2){float s=StaticD(uv,t)*l0;vec2 m1=DropL(uv,t)*l1;vec2 m2=DropL(uv*1.85,t)*l2;float c=s+m1.x+m2.x;c=smoothstep(.3,1.,c);return vec2(c,max(m1.y*l0,m2.y*l1));}',
/* 窗玻璃本身：陽光照到的灰塵、指紋、眩光；下雪時角落結霜、雪花黏在窗上 */
'vec3 pane(vec2 p,vec3 col){',
' float sI=uSunV*gOcc*tw(uSun.y)*(1.-uMist);',
' if(sI>.01){vec2 v=p-uSunP;float r=length(v)/uV.y;vec3 sc=sunT()*ES;',
'  col+=sc*.06*exp(-r*3.2)*sI;',
'  float a=atan(v.y,v.x);float sb=pow(abs(cos(a*3.+.3)),60.)+.6*pow(abs(cos(a*4.+1.1)),90.);col+=sc*.045*sb*exp(-r*6.)*sI;',
'  vec2 gg=floor(p/7.);float hh=h21(gg+19.);if(hh>.992){vec2 cc=(gg+.5)*7.+(vec2(h21(gg+3.),h21(gg+4.))-.5)*5.;col+=sc*.05*smoothstep(1.3,0.,length(p-cc))*exp(-r*1.6)*sI;}',
'  float sm=fbm(p/vec2(140.,60.)+vec2(7.,1.),3);col+=sc*.05*smoothstep(.5,.8,sm)*exp(-r*1.1)*sI;',
'  for(int k=1;k<4;k++){float f=float(k)*.55;vec2 gp=uSunP+(uV*.5-uSunP)*(1.+f);float gr=float(k)*14.+12.;float dd=length(p-gp);float ring=smoothstep(gr,gr*.85,dd)*(.35+.65*smoothstep(gr*.6,gr*.95,dd));col+=mix(vec3(.3,.9,.7),vec3(1.,.5,.8),float(k)*.4)*.012*ring*sI*ES;}}',
' if(uMoonV>.02){vec2 v=p-uMoonP;float r=length(v)/uV.y;col+=vec3(.75,.8,.95)*.05*exp(-r*5.)*uMoonV*(1.-uMist);}',
/*  流星：晴朗的晚上，大約每三分鐘一顆，劃過不到一秒 */
' float sv=(1.-tw(uSun.y+.12))*(1.-uCov*1.1)*(1.-uMist);if(sv>.05){float cyc=floor(uT/170.);float ph=(uT-cyc*170.)/.8;',
'  if(ph<1.){vec2 s0=vec2(h21(vec2(cyc,1.))*uV.x,uV.y*(.08+.25*h21(vec2(cyc,2.))));vec2 dv=normalize(vec2(h21(vec2(cyc,3.))>.5?1.:-1.,.55));vec2 hd=s0+dv*ph*uV.x*.45;',
'   vec2 rel=p-hd;float along=dot(rel,-dv);float perp=abs(dot(rel,vec2(-dv.y,dv.x)));float tail=uV.x*.18;',
'   col+=vec3(.9,.95,1.)*smoothstep(1.4,0.,perp)*smoothstep(tail,0.,along)*step(0.,along)*sin(ph*3.14)*sv*1.6;}}',
' if(uFrost>0.){vec2 cn=min(p,uV-p);float e=min(length(cn)*.75,min(cn.x,cn.y)*1.6)/uV.x;float m=smoothstep(.46,.0,e+(fbm(p/30.,3)-.5)*.25)*uFrost;',
'  float cr=pow(1.-abs(2.*vn(p/3.2)-1.),4.)+pow(1.-abs(2.*vn(p/7.+4.)-1.),5.)*.8+pow(1.-abs(2.*vn(p/15.+9.)-1.),6.)*.6;',
'  col=mix(col,col*.6+vec3(.25,.3,.36),m*.7);col+=vec3(.8,.9,1.)*cr*m*.8;',
'  vec2 g=floor(p/34.);float h=h21(g+71.);if(h>.55){vec2 cc=(g+.2+.6*vec2(h21(g+5.),h21(g+6.)))*34.;vec2 v=p-cc;float r=length(v);float life=fract(uT*.02+h*7.);float al=smoothstep(0.,.08,life)*smoothstep(1.,.6,life);',
'   float a=atan(v.y,v.x);float sz=2.5+h*4.;float arm=smoothstep(.75,1.,abs(cos(a*3.+h*6.)))*smoothstep(sz,0.,r)+smoothstep(sz*.35,0.,r);col=mix(col,vec3(.95,.97,1.),clamp(arm,0.,1.)*al*uFrost*.85);}}',
' return col;}',
'vec3 world(vec2 p,float lod0,out float gm,out float tk){',
' int top=-1;float tsd=1e9;float shd=0.;gm=0.;tk=0.;',
' for(int i=0;i<24;i++){if(i>=uN)break;vec4 c=uC[i];if(p.x<c.x||p.y<c.y||p.x>c.z||p.y>c.w)continue;vec4 r=uR[i];',
'  float sd=sdRB(p-r.xy-r.zw*.5,r.zw*.5,uRad[i]);if(sd<1.){top=i;tsd=sd;}',
'  float s2=sdRB(p-r.xy-r.zw*.5-vec2(0.,8.),r.zw*.5,uRad[i]);float sk=uK[i].a>4.5?.45:.24;shd=max(shd,(1.-smoothstep(-6.,22.,s2))*sk*uOp[i]);}',
' if(top<0)return skyAt(p,lod0)*(1.-shd);',
' vec4 r=uR[top];float rad=uRad[top];vec4 K=uK[top];vec2 cq=p-r.xy-r.zw*.5;vec2 hb=r.zw*.5;',
' float e1=sdRB(cq+vec2(1,0),hb,rad)-sdRB(cq-vec2(1,0),hb,rad);float e2=sdRB(cq+vec2(0,1),hb,rad)-sdRB(cq-vec2(0,1),hb,rad);vec2 n=normalize(vec2(e1,e2)+1e-5);',
' vec2 ld=normalize(uSunP+vec2(uGy*60.,0.)-p+1e-4);vec3 g;float kind=K.a;float press=0.;float drop=0.;if(kind>4.5){press=kind-5.;kind=1.;drop=1.;}else if(kind>1.5){press=kind-2.;kind=1.;}',
/*  水面：平常微微起伏；按下時從手指的位置盪開幾圈水波，把後面的景色推開再收回 */
' float wa=kind>.5||kind<-.5?1.:.45;vec2 wob=(vec2(vn(p/64.+vec2(uT*.22,0.)),vn(p/64.+vec2(5.,uT*.18)))-.5)*6.*wa;',
' if(uRip.z<1.3&&uRip.x>r.x&&uRip.x<r.x+r.z&&uRip.y>r.y&&uRip.y<r.y+r.w){float age=uRip.z;vec2 dv=p-uRip.xy;float rr=length(dv);float c=age*max(r.z,r.w)*.75+4.;float x=rr-c;',
'  float env=exp(-x*x/1100.)*(1.-age/1.3)*(1.-age/1.3)*uRip.w*smoothstep(0.,10.,rr);float ph=x*.22;',
'  wob+=normalize(dv+1e-4)*sin(ph)*env*11.;gRip=cos(ph)*env;}',
' vec2 pw=p+wob;',
' if(kind<-.5){',
/*  圓環：一片厚的圓形玻璃透鏡。微微放大後面的天空，邊緣有厚度、反光 */
'  float R=hb.x;float bw=R*.2;float d=clamp(-tsd/bw,0.,1.);float h=sqrt(1.-(1.-d)*(1.-d));float k=1.-h;',
'  vec2 sp=r.xy+hb+cq*.8-n*k*bw*2.6+wob;float LL=mix(1.3,.4,uDay);vec3 c0=skyAt(sp,LL);if(k>.02){c0.r=skyAt(sp-n*k*bw*.35,LL).r;c0.b=skyAt(sp+n*k*bw*.35,LL).b;}',
'  g=mix(c0*(.66-.2*uLum)+.01,c0*.88+vec3(.15,.16,.18),uDay);',
'  float edge=smoothstep(-3.5,-.4,tsd);vec2 Ld=normalize(vec2(-.45,-1.));float up=max(dot(n,Ld),0.);float dn2=max(dot(n,-Ld),0.);float face=max(dot(n,ld),0.)*gOcc;',
'  g*=1.-.25*smoothstep(.1,.8,k)*(1.-edge);g+=edge*(.2+1.3*pow(up,2.)+.8*face+.5*pow(dn2,2.)+2.5*uFlash);g+=pow(k,1.5)*dn2*.5;',
'  vec2 cc2=(cq-vec2(-R*.18,-R*.42))/(vec2(R*.62,R*.34));g+=smoothstep(1.,.05,length(cc2))*.10;',
' }else if(kind<.5){',
/*  霧面面板 */
'  float bw=min(18.,min(hb.x,hb.y));float e=1.-smoothstep(0.,bw,-tsd);',
'  g=skyF(pw+n*e*e*bw*1.4);g=mix(g*(.80-.22*uLum)+.018,g*.82+vec3(.2,.21,.24),uDay);',
'  float face=max(dot(n,ld),0.);float rim=smoothstep(-3.,-.3,tsd);g+=rim*(.05+.35*face*gOcc+1.5*uFlash)*mix(vec3(1.),sunT()*1.6,.4);',
'  g+=e*e*.035;g+=.04*(1.-smoothstep(0.,hb.y*1.2,p.y-r.y));',
' }else{',
/*  液態玻璃：中間清楚、邊緣像透鏡一樣把背景彎進來、分出一點彩虹邊，上緣和朝光處亮 */
'  float bw=min(min(hb.x,hb.y)*.95,22.)*(1.+press*.35);float d=clamp(-tsd/bw,0.,1.);float h=sqrt(1.-(1.-d)*(1.-d));float k=(1.-h);',
'  vec2 off=-n*k*bw*(2.2+press*1.5)+(cq/max(hb,vec2(1.)))*(-6.*press);',
'  vec3 c0=skyAt(pw+off,.2);',
'  if(k>.02){c0.r=skyAt(pw+off*1.18,.2).r;c0.b=skyAt(pw+off*.82,.2).b;}',
'  g=mix(c0*(1.04-.18*uLum),c0*.9+vec3(.16,.17,.19),uDay);',
'  vec3 tint=K.rgb;float tl=dot(tint,vec3(1.));if(tl>.01){g=tint*(.78+.45*h)+c0*.1;tk=1.;}',
'  float edge=smoothstep(-3.,-.4,tsd);vec2 Ld=normalize(vec2(-.45,-1.));float up=max(dot(n,Ld),0.);float dn2=max(dot(n,-Ld),0.);float face=max(dot(n,ld),0.)*gOcc;',
'  g*=1.-.22*smoothstep(.05,.7,k)*(1.-edge);',
'  g+=edge*(.25+1.5*pow(up,2.)+.9*face+.6*pow(dn2,2.)+2.5*uFlash);',
'  g+=pow(k,1.5)*dn2*.45;',
'  vec2 cc2=(cq-vec2(0.,-hb.y*.42))/(hb*vec2(.82,.42));g+=smoothstep(1.,.1,length(cc2))*.16*(1.-press*.5);',
'  g+=press*.08;',
/*  路線條上的水珠：像一滴厚厚的水——中間把後面放大、邊緣暗、左上一點強反光、右下聚光 */
'  if(drop>.5){vec2 q=cq/hb;float rr=length(q);',
/*   透明的水滴：像透鏡一樣把後面的景色倒過來放大；邊緣一圈細細的暗邊；左上一點清楚的反光；狀態色只在底部的聚光和外圈，不染整顆 */
'   vec3 cb=skyAt(r.xy+hb-cq*.55+wob,.0);g=cb*1.06+.03;',
'   g*=1.-.5*smoothstep(.8,1.,rr)*(1.-smoothstep(-1.2,-.2,tsd));',
'   float lo2=max(dot(q,vec2(.25,.97)),0.);g+=K.rgb*(1.2*exp(-(rr-.74)*(rr-.74)*70.)*(.35+.65*lo2)+.5*exp(-dot(q-vec2(.18,.55),q-vec2(.18,.55))*7.));',
'   g+=vec3(1.)*(6.*exp(-dot(q-vec2(-.34,-.42),q-vec2(-.34,-.42))*90.)+1.2*exp(-dot(q-vec2(-.34,-.42),q-vec2(-.34,-.42))*14.)*.4);',
'   g+=vec3(1.)*smoothstep(-1.,-.2,tsd)*(.4+.8*max(dot(n,normalize(vec2(-.45,-1.))),0.));}',
' }',
/*  按下：從手指的位置在這片玻璃裡盪開一圈光 */
/*  水面上的光斑：液態玻璃和圓環上，光被起伏的水面聚成會飄的亮紋 */
' float rin=(uRip.z<1.1&&uRip.x>r.x&&uRip.x<r.x+r.z&&uRip.y>r.y&&uRip.y<r.y+r.w)?1.-uRip.z/1.1:0.;',
' if((kind>.5||kind<-.5)&&(tk>.5||rin>0.)){float cw=tk>.5?.7:rin;float a1=vn(pw/26.+vec2(uT*.3,uT*.17)),a2=vn(pw/19.-vec2(uT*.21,-uT*.1));float ca=pow(1.-abs(a1-a2),14.);g+=vec3(1.,.99,.95)*ca*.12*(1.-uDay*.3)*cw;}',
' float op=uOp[top];',
' gm=(1.-smoothstep(-.6,.6,tsd))*op;if(gm>.999)return g;return mix(g,skyAt(p,lod0)*(1.-shd),1.-gm);}',
'void main(){',
' vec2 p=vec2(gl_FragCoord.x,uV.y*uS-gl_FragCoord.y)/uS;gOcc=texelFetch(uOcc,ivec2(0),0).r;',
' vec2 dn=vec2(0.);float dm=0.,trl=0.;float wp=texture(uWp,p/uV).r;',
/* 窗上的水：一次算，法線用螢幕導數（省掉兩次重算） */
' if(uDL.x+uDL.y+uDL.z>.002){vec4 D=texture(uDr,tuv(p));dn=(D.xy-.5)*.5;dm=D.z;trl=D.w;}',
' float fogW=max(clamp(uWet*1.1,0.,1.)*(1.-trl*.9),uMist)*(1.-smoothstep(.1,.25,dm))*(1.-wp);',
' vec2 q=p+dn*240.;float gm,tk;vec3 col=world(q,fogW*3.4,gm,tk);',
' if(gm<.5)col+=stars(q)*(1.-fogW);',
' if(fogW>0.){col=mix(col,col*.92+vec3(.03),fogW*.6);}',
' if(dm>.02){float sh2=clamp(dot(dn,vec2(.35,1.))*-14.,-1.,1.);col*=1.+.12*smoothstep(.1,.8,dm)+.35*sh2*smoothstep(.05,.5,dm);col+=vec3(1.)*pow(max(sh2,0.),6.)*.5*smoothstep(.3,.9,dm);}',
' col=pane(p,col);',
' float rn=uRain>.01?(rainL(p,5.,1.6)*.28+rainL(p+37.,8.,2.2)*.22)*(1.-fogW*.7):0.;',
' float sn=uSnow>.01?(snowL(p,26.,40.)*.9+snowL(p+11.,40.,64.)):0.;',
' float inG=gm>.5?.35:1.;',
' float sh=(smoothstep(.0,.5,1.-abs((p.x/uV.x+p.y/uV.y*.6)-.55)*3.)*.05+smoothstep(.0,.3,1.-abs((p.x/uV.x+p.y/uV.y*.6)-.82)*9.)*.03)*(1.-uMist*.7);col+=vec3(sh)*(1.-uNight*.6);',
' col=1.-exp(-col*1.1);col=pow(col,vec3(1./1.9));',
' float ly=dot(col,vec3(.3,.59,.11));col*=1.-mix(.2*smoothstep(.62,1.,ly),.42*smoothstep(.4,.95,ly)*(1.-uDay),gm*(1.-tk));',
/* 「到了 / 走了」：一道帶一點彩虹色的光斜斜掃過所有玻璃，前緣略暗，白玻璃上也看得出來 */
' if(uSwp<1.&&gm>.01){float bp=(p.x/uV.x*.6+p.y/uV.y)*.62;float bd=bp-(uSwp*1.5-.25);float band=smoothstep(.1,0.,abs(bd));vec3 ir=.5+.5*cos(6.283*(bp*2.5+vec3(0.,.33,.67)));',
'  col=col*(1.-.22*smoothstep(.16,.05,bd)*smoothstep(-.02,.05,bd)*gm)+mix(vec3(1.),ir,.55)*band*.45*gm*(1.-uSwp*.5);}',
' col=col*(1.-max(-gRip,0.)*.22)+vec3(1.)*max(gRip,0.)*.28;',
' col+=vec3(.75,.82,.9)*rn*uRain*inG+vec3(1.)*sn*uSnow*inG*.85;',
' float dt=h21(gl_FragCoord.xy+fract(uT))/255.;o=vec4(col+dt,1.);}'].join('\n');
var UN='uGy uSwp uOp uRip uScape uFlash uDay uDr uV uS uT uCov uRain uSnow uFog uNight uWind uTilt uLum uMoonPh uMoonV uSunV uSun uMoon uSunP uMoonP uN uR uC uRad uK uWet uMist uFrost uSR uDL uSky uOcc uWp'.split(' ');
function mkProg(fs){function sh(t,src){var x=gl.createShader(t);gl.shaderSource(x,src);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS)){console.warn(gl.getShaderInfoLog(x));return null}return x}
  var v=sh(gl.VERTEX_SHADER,VS),f=sh(gl.FRAGMENT_SHADER,fs);if(!v||!f)return null;var p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.warn(gl.getProgramInfoLog(p));return null}var u={};UN.forEach(function(k){u[k]=gl.getUniformLocation(p,k)});return {p:p,u:u}}
function mkTex(w,h,mip){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,mip?gl.LINEAR:gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
function mkFB(t){var f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
  var ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);return ok?f:null}
function mkGL(c){try{gl=c.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,preserveDrawingBuffer:true,powerPreference:'low-power'})}catch(e){gl=null}
  if(!gl)return false;
  PR.occ=mkProg(OCC_FS);PR.sky=mkProg(SKY_FS);PR.comp=mkProg(COMP_FS);PR.drop=mkProg(DROP_FS);if(!PR.occ||!PR.sky||!PR.comp||!PR.drop){gl=null;return false}
  var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  txO=mkTex(1,1,false);fbO=mkFB(txO);if(!fbO){gl=null;return false}
  /* 手指擦掉窗上霧氣用的遮罩（小張的灰階圖，慢慢再起霧） */
  wpc=document.createElement('canvas');wpc.width=96;wpc.height=192;wpx=wpc.getContext('2d');
  wtex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,wtex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,wpc);
  return true}
function wipe(x,y,px,py){if(!wpx)return;var sx2=96/W,sy2=192/H,r=24*sx2;wpx.lineCap='round';wpx.strokeStyle='rgba(255,255,255,.9)';wpx.lineWidth=r*2;
  wpx.beginPath();wpx.moveTo((px==null?x:px)*sx2,(py==null?y:py)*sy2);wpx.lineTo(x*sx2,y*sy2);wpx.stroke();wDirty=true;wAny=true}
function wipeDecay(ts){if(!wAny||ts-wLast<120)return;wLast=ts;wpx.globalCompositeOperation='destination-out';wpx.fillStyle='rgba(0,0,0,.025)';wpx.fillRect(0,0,96,192);wpx.globalCompositeOperation='source-over';wDirty=true;
  if(++wN%40===0){var d=wpx.getImageData(0,0,96,192).data,m=0;for(var i=3;i<d.length;i+=16)m=Math.max(m,d[i]);if(m<8){wpx.clearRect(0,0,96,192);wAny=false}}}
function sx(az){return W*(.5+az/150)}
function sy(alt){var hz=H*.64;return hz-clamp(alt,-89,89)/75*hz}
function dir(az,alt){az*=Math.PI/180;alt*=Math.PI/180;return [Math.sin(az)*Math.cos(alt),Math.sin(alt),Math.cos(az)*Math.cos(alt)]}
/* 解析度：合成用手機原生（最多 2 倍），天空用低解析度。太慢時一級一級往下降 */
var QL=[[2,.8],[1.5,.7],[1.25,.6],[1,.5]];
function size(){if(!cv)return;DPR=window.devicePixelRatio||1;var q=QL[Q];RS=Math.min(DPR,q[0]);SR=Math.min(q[1],DPR*.5+.2);W=cv.clientWidth||innerWidth;H=cv.clientHeight||innerHeight;LW=W;LH=H;
  cv.width=Math.round(W*RS);cv.height=Math.round(H*RS);drops.width=drops.height=1;
  if(gl){var w=Math.max(8,Math.round(W*SR)),h=Math.max(8,Math.round(H*SR));if(w!==SW||h!==SH){SW=w;SH=h;if(txS)gl.deleteTexture(txS);if(fbS)gl.deleteFramebuffer(fbS);txS=mkTex(SW,SH,true);fbS=mkFB(txS)}
    var dw=Math.max(8,Math.round(W*RS*.5)),dh=Math.max(8,Math.round(H*RS*.5));if(dw!==DW||dh!==DH){DW=dw;DH=dh;if(txD)gl.deleteTexture(txD);if(fbD)gl.deleteFramebuffer(fbD);txD=mkTex(DW,DH,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);fbD=mkFB(txD)}}
  sig='';jump=true}
/* 面板的位置：每一幀讀一次，有變（捲動、展開）就立刻重畫，玻璃才跟得上 */
function clipOf(el){var c=null,a=el.parentElement;while(a&&a!==document.body){var cs=getComputedStyle(a);if(cs.overflowX!=='visible'||cs.overflowY!=='visible'){c=a;break}a=a.parentElement}return c}
var KB=new Float32Array(NMAX*4),tintC=new WeakMap(),prC=new WeakMap(),pressEl=null;
function toLin(c){return c.map(function(v){v=Math.pow(clamp(v/255,0,.97),1.9);return -Math.log(1-v)/1.1})}
function tintOf(el){if(el.matches('.opt.ai'))return toLin([52,138,190]);if(!el.matches('.pb'))return [0,0,0];var v=getComputedStyle(el).getPropertyValue('--c').trim()||getComputedStyle(el).getPropertyValue('--line').trim(),m;
  if(/^#[0-9a-f]{6}/i.test(v))m=hex(v);else if((m=v.match(/\d+(\.\d+)?/g)))m=m.slice(0,3).map(Number);else return [0,0,0];return toLin(m)}
var RB=new Float32Array(NMAX*4),CB=new Float32Array(NMAX*4),RD=new Float32Array(NMAX),nR=0;
function collect(){var els=document.querySelectorAll(GSEL),n=0,s='',fadeMode=document.body.classList.contains('intro')||document.body.classList.contains('lock');
  for(var k=0;k<els.length&&n<NMAX;k++){var el=els[k];if(el.matches(SOLID))continue;var r=el.getBoundingClientRect(),isD=el.classList&&el.classList.contains('dial');if(isD){var ins=r.width*.03;r={left:r.left+ins,top:r.top+ins,width:r.width-2*ins,height:r.height-2*ins,right:r.right-ins,bottom:r.bottom-ins}}if(r.width<4||r.height<4||r.bottom<0||r.top>H||r.right<0||r.left>W)continue;
    var cl=clipC.get(el);if(cl===undefined){cl=clipOf(el);clipC.set(el,cl)}var c=cl?cl.getBoundingClientRect():{left:-1e4,top:-1e4,right:1e4,bottom:1e4};
    if(r.right<c.left||r.left>c.right||r.bottom<c.top||r.top>c.bottom)continue;
    var rad=radC.get(el);if(rad===undefined){rad=el instanceof SVGElement||isD?1e4:parseFloat(getComputedStyle(el).borderTopLeftRadius)||0;radC.set(el,rad)}rad=Math.min(rad,r.width/2,r.height/2);
    var lq=el.matches(LQ),tn=tintC.get(el);if(tn===undefined){tn=tintOf(el);tintC.set(el,tn)}
    var pv=prC.get(el)||0;pv=(el===pressEl||(document.body.classList.contains('dragging')&&el.classList&&el.classList.contains('kb')))?Math.min(1,pv+.25):Math.max(0,pv-.12);prC.set(el,pv);
    KB.set([tn[0],tn[1],tn[2],isD?-1:lq?(pv>0?2+pv:1):0],n*4);s+=pv.toFixed(2);
    var op=1;if(fadeMode){for(var e2=el;e2&&e2!==document.body;e2=e2.parentElement){op*=+getComputedStyle(e2).opacity}}OPB[n]=op;s+=op.toFixed(2);
    RB.set([r.left,r.top,r.width,r.height],n*4);CB.set([c.left,c.top,c.right,c.bottom],n*4);RD[n]=rad;n++;
    s+=(r.left|0)+','+(r.top|0)+','+(r.width|0)+','+(r.height|0)+';'}
  nR=n;var ch=s!==sig;sig=s;return ch}
/* ---- 參數緩動：目標值 T，目前值 A。[上升時間, 下降時間]（秒） ---- */
var TAU={sunAz:[.35,.35],sunAlt:[.35,.35],moonAz:[.35,.35],moonAlt:[.35,.35],cov:[1.6,1.6],rainD:[1.6,1.2],snow:[2.5,1.2],fog:[2.5,1.5],night:[.5,.5],wind:[2,2],tiltW:[2,2],lum:[.8,.8],
  moonV:[1,1],sunV:[1.2,1.2],wet:[2.5,1.8],mist:[4,2.2],frost:[6,2.2],dl0:[3,2.2],dl1:[2,.8],dl2:[2.5,.9],day:[.8,.8]};
function targets(r){var rain=r.kind==='rain'||r.kind==='storm',snow=r.kind==='snow',fog=r.kind==='fog',pr=r.pr||0;
  return {sunAz:r.sunAz,sunAlt:r.sunAlt,moonAz:r.moonAz,moonAlt:r.moonAlt,cov:clamp(Math.max(r.cc,.14)*((rain||snow)?1.08:1),0,1),
    rainD:r.kind==='storm'?1:rain?clamp(.55+pr/6,0,.92):(snow?.35:0),snow:snow?1:0,fog:fog?.75:0,night:r.night,wind:2+r.ws*.25,tiltW:clamp(r.ws/60,0,.45),lum:S.lum||0,
    moonV:r.moonAlt>0?r.moonFrac*(1-r.cc*.8):0,sunV:(1-r.cc*.85)*(r.sunAlt>-1?1:0),
    wet:rain?clamp(.55+pr/5,0,1):0,mist:fog?.8:(snow?.3:0),frost:snow?1:0,
    dl0:rain?clamp(.55+pr/5,0,1)*2:(fog?1.6:(snow?.22:0)),dl1:rain?clamp(.4+pr/5,0,1):(fog?.12:0),dl2:rain?clamp(.6+pr/5,0,1):0,day:S.day?1:0}}
function step(dt){if(!T)return false;if(!A||calm){A=JSON.parse(JSON.stringify(T));return false}var mv=false;
  for(var k in T){var a=A[k],t=T[k],d=t-a;if((k==='sunAz'||k==='moonAz')&&Math.abs(d)>180)d-=360*Math.sign(d);if(Math.abs(d)<1e-3){A[k]=t;continue}
    var tau=TAU[k]?TAU[k][d>0?0:1]:1;A[k]=a+d*(1-Math.exp(-dt/1000/tau));if((k==='sunAz'||k==='moonAz')&&Math.abs(A[k])>180)A[k]-=360*Math.sign(A[k]);mv=true}
  return mv}
function setU(P,t){var u=P.u,a=A;gl.useProgram(P.p);
  gl.uniform2f(u.uV,W,H);gl.uniform1f(u.uT,calm?0:t);
  gl.uniform3fv(u.uSun,dir(a.sunAz,a.sunAlt));gl.uniform3fv(u.uMoon,dir(a.moonAz,a.moonAlt));gl.uniform2f(u.uSunP,sx(a.sunAz),sy(a.sunAlt));gl.uniform2f(u.uMoonP,sx(a.moonAz),sy(a.moonAlt));
  gl.uniform1f(u.uCov,a.cov);gl.uniform1f(u.uRain,a.rainD);gl.uniform1f(u.uSnow,a.snow);gl.uniform1f(u.uFog,a.fog);gl.uniform1f(u.uNight,a.night);gl.uniform1f(u.uWind,a.wind);
  gl.uniform1f(u.uTilt,a.tiltW+(calm?0:(S.tiltS||0)*.45));gl.uniform1f(u.uLum,a.lum);gl.uniform1f(u.uMoonPh,S.r.moonPhase);gl.uniform1f(u.uMoonV,a.moonV);gl.uniform1f(u.uSunV,a.sunV);
  gl.uniform1f(u.uWet,a.wet);gl.uniform1f(u.uMist,a.mist);gl.uniform1f(u.uFrost,a.frost);gl.uniform3f(u.uDL,a.dl0,a.dl1,a.dl2);gl.uniform1f(u.uSR,SR);gl.uniform1f(u.uDay,a.day);gl.uniform1f(u.uScape,S.scape||0);gl.uniform1f(u.uFlash,FL.v);gl.uniform1f(u.uGy,calm?0:S.tiltS||0);var now=performance.now();gl.uniform1f(u.uSwp,SWP?Math.min(1,(now-SWP)/900):1);
  gl.uniform4f(u.uRip,RIP.x,RIP.y,RIP.t?(now-RIP.t)/1000:9,RIP.s)}
function drawSky(t){
  setU(PR.occ,t);gl.uniform1f(PR.occ.u.uS,1);gl.bindFramebuffer(gl.FRAMEBUFFER,fbO);gl.viewport(0,0,1,1);gl.drawArrays(gl.TRIANGLES,0,3);
  setU(PR.sky,t);gl.uniform1f(PR.sky.u.uS,SR);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,txO);gl.uniform1i(PR.sky.u.uOcc,1);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbS);gl.viewport(0,0,SW,SH);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,txS);gl.generateMipmap(gl.TEXTURE_2D)}
function drawDrops(t){if(A.dl0+A.dl1+A.dl2<=.002)return;var P=PR.drop;setU(P,t);gl.uniform1f(P.u.uS,RS*.5);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,wtex);if(wDirty){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,wpc);wDirty=false}gl.uniform1i(P.u.uWp,2);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbD);gl.viewport(0,0,DW,DH);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
function drawComp(t){drawDrops(t);var P=PR.comp,u=P.u;setU(P,t);gl.uniform1f(u.uS,RS);
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,txD);gl.uniform1i(u.uDr,3);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,txS);gl.uniform1i(u.uSky,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,txO);gl.uniform1i(u.uOcc,1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,wtex);if(wDirty){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,wpc);wDirty=false}gl.uniform1i(u.uWp,2);
  gl.uniform1i(u.uN,nR);if(nR){gl.uniform1fv(u.uOp,OPB);gl.uniform4fv(u.uR,RB);gl.uniform4fv(u.uC,CB);gl.uniform1fv(u.uRad,RD);gl.uniform4fv(u.uK,KB)}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cv.width,cv.height);gl.drawArrays(gl.TRIANGLES,0,3)}
/* 省電分級：天氣在變、拖動、下雨下雪時全速；晴天靜止時天空每秒 10 張、合成看有沒有東西在動 */
var LW=0,LH=0,CK=0;
function loop(ts){if(!on)return;raf=requestAnimationFrame(loop);if(++CK%20===0)chk();if(wpx)wipeDecay(ts);
  var dt=lastT?Math.min(ts-lastT,100):16;
  if(lastT){slow=slow*.95+(dt>45?1:0)*.05;if(slow>.6&&Q<QL.length-1){Q++;slow=0;size()}}lastT=ts;
  /* 打雷：隨機 8～25 秒一次閃光（減少動態時不閃） */
  if(S.r&&S.r.kind==='storm'&&!calm){if(!FL.next)FL.next=ts+3000;if(ts>FL.next){FL.v=1;FL.dbl=Math.random()<.5?ts+180:0;FL.next=ts+8000+Math.random()*17000}
    if(FL.dbl&&ts>FL.dbl){FL.v=.8;FL.dbl=0}}else FL.next=0;
  if(FL.v>0){FL.v=Math.max(0,FL.v-dt/220);jump=true}
  var anim=step(dt),ch=collect()||wDirty,wetA=A.dl0+A.dl1+A.dl2>.01||A.snow>.01||A.rainD>.05||A.frost>.01;
  var fx=(SWP&&ts-SWP<950)||(RIP.t&&ts-RIP.t<1350)||document.body.classList.contains('intro')||(S.tiltS&&Math.abs(S.tiltS-(S.tiltP||0))>.005);S.tiltP=S.tiltS;if(fx)ch=true;
  var skyInt=anim?33:(A.rainD>.05||A.snow>.01)?66:100,compInt=(anim||wetA)?33:66;
  var ns=jump||ts-lastSky>=skyInt;if(ns){drawSky(ts/1000);lastSky=ts;jump=false}
  if(ns||ch||ts-lastComp>=compInt){drawComp(ts/1000);lastComp=ts}}
function chk(){if(cv&&(cv.clientWidth!==LW||cv.clientHeight!==LH))size()}
function poke(){if(!gl||!S.r||!txS)return;chk();if(!A||calm)step(0);collect();var t=performance.now()/1000;drawSky(t);drawComp(t)}
function drawGlass(){}
function paintBody(r){var b=document.body.style;b.setProperty('--sky-z',rgb(r.z));b.setProperty('--sky-h',rgb(r.h));
  /* 天空越亮，文字底下的暗襯越重，白天戶外也看得清 */
  var Y=function(c){return (.2126*c[0]+.7152*c[1]+.0722*c[2])/255},lum=clamp((Y(r.z)+Y(r.h))/2*1.6-.35,0,1);b.setProperty('--lum',lum.toFixed(2));S.lum=lum;
  /* 白天：面板變亮、字變深（有一點遲滯，黃昏不會來回跳） */
  var day=S.day?lum>.36:lum>.5;if(day!==S.day){S.day=day;document.body.classList.toggle('day',day);if(T)T.day=day?1:0}
  /* 玻璃高光：跟著太陽（晚上跟著月亮），黃昏偏暖 */
  var src=r.sunAlt>-4?{az:r.sunAz,alt:r.sunAlt}:{az:r.moonAz,alt:r.moonAlt},x=clamp(.5+src.az/150,.08,.92)*100;
  var a=r.sunAlt>-4?.30*(1-r.cc*.5):.14*(r.moonAlt>0?r.moonFrac:.3),tint=mixc([255,255,255],[255,206,160],r.golden);
  b.setProperty('--hl-x',(x+S.tilt*14).toFixed(1)+'%');b.setProperty('--hl-c',rgb(tint,a.toFixed(3)));b.setProperty('--hl-ang',(180+src.az*.5).toFixed(0)+'deg');
  document.querySelector('meta[name=theme-color]')&&document.querySelector('meta[name=theme-color]').setAttribute('content',rgb(r.z))}
return {
  init:function(c,d){cv=c;drops=d;dctx=d.getContext('2d');S.tilt=0;glass=[];calm=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches);GL_OK=mkGL(c);size();
    addEventListener('resize',function(){size();poke()});
    var rz=function(){size();poke()};if(window.visualViewport)visualViewport.addEventListener('resize',rz);addEventListener('orientationchange',function(){setTimeout(rz,300)});addEventListener('pageshow',rz);if(window.ResizeObserver)new ResizeObserver(rz).observe(cv);setTimeout(rz,400);setTimeout(rz,1200);
    addEventListener('scroll',function(){if(calm)poke()},true);
    addEventListener('pointerdown',function(e){pressEl=e.target.closest&&e.target.closest(LQ);var g=e.target.closest&&e.target.closest(GSEL);if(g&&!calm){RIP={x:e.clientX,y:e.clientY,t:performance.now(),s:pressEl?1:.6}}},true);
    ['pointerup','pointercancel','pointerleave'].forEach(function(k){addEventListener(k,function(){pressEl=null;wPrev=null},true)});
    /* 起霧、下雨、下雪時，手指在窗上滑過可以擦出一塊清楚的 */
    addEventListener('pointermove',function(e){if(!on||!S.r||(S.r.kind!=='fog'&&S.r.kind!=='rain'&&S.r.kind!=='storm'&&S.r.kind!=='snow'))return;if(e.pointerType==='mouse'&&!e.buttons)return;
      if(e.target.closest&&e.target.closest('input,textarea,select,.strip,#sheet,#tabs'))return;if(wDown&&Math.hypot(e.clientX-wDown[0],e.clientY-wDown[1])>12)wMoved=true;if(!wMoved)return;wipe(e.clientX,e.clientY,wPrev&&wPrev[0],wPrev&&wPrev[1]);wPrev=[e.clientX,e.clientY]},{passive:true,capture:true});
    addEventListener('pointerdown',function(e){wDown=[e.clientX,e.clientY];wMoved=false},true);
    /* 擦窗的手勢不要誤按到按鈕 */
    addEventListener('click',function(e){if(wMoved){wMoved=false;e.preventDefault();e.stopPropagation()}},true);
    addEventListener('deviceorientation',function(e){if(e.gamma==null)return;S.tilt=clamp(e.gamma/45,-1,1);S.tiltS=(S.tiltS||0)*.8+S.tilt*.2;if(S.r)paintBody(S.r)});
    return GL_OK},
  ok:function(){return GL_OK},
  sweep:function(){if(!calm)SWP=performance.now()},
  set:function(p){if(typeof SunCalc==='undefined')return;S.scape=p.scape==='sea'?1:p.scape==='city'?2:0;var k=[p.scape,p.lat,p.lng,Math.round(p.at.getTime()/60000),JSON.stringify(p.wx||{})].join('|');
    if(k===S.k)return;S.k=k;S.r=compute(p);paintBody(S.r);T=targets(S.r);if(!A)step(0);if(!on||calm)poke()},
  poke:function(){if(on)requestAnimationFrame(poke)},
  on:function(v){v=!!v&&!document.hidden;document.body.classList.toggle('glgl',!!v&&GL_OK);if(v===on)return;on=v;
    if(on){if(calm)poke();else raf=requestAnimationFrame(loop)}else{cancelAnimationFrame(raf);dctx&&dctx.clearRect(0,0,W,H)}},
  info:function(){return S.r}
}})();
