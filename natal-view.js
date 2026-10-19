/* Natal reading view — ported 1:1 from OPHANARK v3 (rS / Ch components). */
(function(){
var SIGN={"Koç":0,"Boğa":1,"İkizler":2,"Yengeç":3,"Aslan":4,"Başak":5,"Terazi":6,"Akrep":7,"Yay":8,"Oğlak":9,"Kova":10,"Balık":11};
var EN={Gunes:"Sun",Ay:"Moon",Merkur:"Mercury",Venus:"Venus",Mars:"Mars",Jupiter:"Jupiter",Saturn:"Saturn",Uranus:"Uranus",Neptun:"Neptune",Pluto:"Pluto"};
var TR={Gunes:"Güneş",Ay:"Ay",Merkur:"Merkür",Venus:"Venüs",Mars:"Mars",Jupiter:"Jüpiter",Saturn:"Satürn",Uranus:"Uranüs",Neptun:"Neptün",Pluto:"Plüton"};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]});}
function glyph(sign){var n=SIGN[sign];return n==null?'':'<span class="nv-glyph">'+String.fromCharCode(97+n)+'</span>';}
function block(o){
  return '<div class="nv-c">'+(o.houseLead&&o.house?'<p class="nv-ev">'+esc(o.house)+'. EV</p>':'')+glyph(o.sign)+
    '<div class="nv-chips">'+(o.sign?'<span>'+esc(o.sign)+'</span>':'')+(o.house&&!o.houseLead?'<span class="g">'+esc(o.house)+'. EV</span>':'')+(o.retro?'<span class="r">geri hareket (retro)</span>':'')+'</div>'+
    '<h4>'+esc(o.title)+'</h4><p class="nv-body">'+esc(o.body)+'</p></div>';
}
function storeMap(chart){
  try{
    if(chart&&chart.planets&&chart.planets.length){
      var P={};chart.planets.forEach(function(p){var k=EN[p.name];if(k)P[k]={lon:p.lon,sign:p.signTr};});
      localStorage.setItem('oph_natal3d',JSON.stringify({P:P,asc:chart.asc,mc:chart.mc}));return true;
    }
  }catch(e){}
  return false;
}
function html(chart,sections,tick){
  var e=chart||{},n=sections||{},h='';
  var has3d=storeMap(e);
  if(has3d) h+='<div class="nv-map"><iframe src="/natal3d_embed.html?trans=1&t='+(tick||0)+'" title="Natal 3D Güneş Sistemi" loading="lazy"></iframe></div>';
  if(e.ascText) h+='<p class="nv-asc">Yükselen <b>'+esc(e.ascText)+'</b> · MC <b>'+esc(e.mcText)+'</b>'+(e.place?' · '+esc(e.place):'')+'</p>';
  if(n.ozet) h+='<p class="nv-ozet">'+esc(n.ozet)+'</p>';
  var nd=e.nodes||{};
  if(n.kad||n.gad){
    h+='<div class="nv-sec"><p class="nv-h">Ay Düğümleri · KAD / GAD</p><div class="nv-stack">';
    if(n.kad) h+=block({sign:(nd.kad||{}).signTr,title:n.kad.baslik||'Kuzey Ay Düğümü (KAD)',house:(nd.kad||{}).house,body:n.kad.yorum});
    if(n.gad) h+=block({sign:(nd.gad||{}).signTr,title:n.gad.baslik||'Güney Ay Düğümü (GAD)',house:(nd.gad||{}).house,body:n.gad.yorum});
    h+='</div></div>';
  }
  if(n.lilith){
    h+='<div class="nv-sec"><p class="nv-h">Kara Ay · Lilith</p>'+block({sign:(nd.lilith||{}).signTr,title:n.lilith.baslik||'Kara Ay Lilith',house:(nd.lilith||{}).house,body:n.lilith.yorum})+'</div>';
  }
  if(n.evler&&n.evler.length){
    h+='<div class="nv-sec"><p class="nv-h">Evler · 12 Ev Yorumu</p><div class="nv-stack">';
    n.evler.forEach(function(v){
      h+='<div class="nv-c"><p class="nv-ev">'+esc(v.ev)+'. EV</p>'+(v.burc?glyph(v.burc):'')+
        '<div class="nv-meta">'+(v.burc?'<span class="a">'+esc(v.burc)+' burcunda</span>':'')+(v.area?'<span class="b">'+esc(v.area)+'</span>':'')+'</div>';
      if(v.gezegenler&&v.gezegenler.length){
        h+='<p class="nv-pl">Bu evde: '+v.gezegenler.map(function(g,i){return (i>0?' · ':'')+'<span class="w">'+esc(g.adTr||TR[g.ad]||g.ad)+'</span>'+(g.retro?'<span class="r"> (retro)</span>':'');}).join('')+'</p>';
      }
      h+='<p class="nv-body nv-hb">'+esc(v.yorum)+'</p></div>';
    });
    h+='</div></div>';
  } else if(n.gezegenler&&n.gezegenler.length){
    /* v3 fallback: planet-by-planet comments grouped by house */
    var d={};(e.planets||[]).forEach(function(p){d[p.name]=p;});
    var groups=[];
    for(var i=1;i<=12;i++){var L=n.gezegenler.filter(function(g){return d[g.ad]&&d[g.ad].house===i;});if(L.length)groups.push({house:i,sign:d[L[0].ad].signTr,planets:L});}
    if(groups.length){
      h+='<div class="nv-sec"><p class="nv-h">Gezegenler · Ev Ev Yorum</p><div class="nv-stack">';
      groups.forEach(function(g){
        h+='<div class="nv-c"><p class="nv-ev">'+g.house+'. EV</p>'+(g.sign?glyph(g.sign)+'<p class="nv-meta"><span class="a">'+esc(g.sign)+' burcunda</span></p>':'')+'<div class="nv-pls">';
        g.planets.forEach(function(p){var pe=d[p.ad]||{};h+='<div><h4>'+esc(TR[p.ad]||p.ad)+(pe.retro?' <span class="r sm">geri hareket (retro)</span>':'')+'</h4><p class="nv-body">'+esc(p.yorum)+'</p></div>';});
        h+='</div></div>';
      });
      h+='</div></div>';
    }
  }
  return h;
}
window.NatalView={html:html,storeMap:storeMap};
})();
