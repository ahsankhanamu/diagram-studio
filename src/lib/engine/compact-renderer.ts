/**
 * compact-renderer.ts — Zero-dependency client-side diagram renderer for exported HTML.
 * Faithfully replicates every node type from the Svelte components using the same
 * color formulas (color-mix equivalents), proportions, and Lucide icon paths.
 */

const RENDERER_CSS = `<style>
@keyframes edge-flow{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}
.ea{stroke-dasharray:5 5;animation:edge-flow .8s linear infinite}
</style>`;

const RENDERER_IIFE = `(function(){
'use strict';
var F='-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
var FM='"SF Mono","Fira Code",monospace';
// Resolved CSS --color-node-* values
var NC={process:'#3b82f6',decision:'#f59e0b',terminal:'#10b981',io:'#3b82f6',document:'#6366f1',service:'#6366f1',database:'#3b82f6',queue:'#f59e0b',api:'#8b5cf6',user:'#10b981',entity:'#f59e0b',workflow:'#10b981','shape-rect':'#3b82f6','shape-circle':'#3b82f6','shape-diamond':'#3b82f6'};
// Resolved CSS variable values (light theme)
var BG='#ffffff',MUT='#9ca3af',BOR='#e5e7eb',SUB='#f3f4f6',TXT='#1f2937',SEC='#4b5563',EDG='#94a3b8';
// Entity key badge styles (rgba backgrounds matching component)
var KB={pk:{bg:'rgba(245,158,11,0.18)',tx:'#b45309'},fk:{bg:'rgba(59,130,246,0.18)',tx:'#1d4ed8'},uk:{bg:'rgba(139,92,246,0.18)',tx:'#6d28d9'}};

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// color-mix(in srgb, h pct%, to) equivalent
// to: 'white' or omit → blend with white; 'transparent' → rgba; '#rrggbb' → blend with that hex
function blend(h,to,pct){
  if(!h||h[0]!=='#')h=BG;
  var r=parseInt(h.slice(1,3),16)||0,g=parseInt(h.slice(3,5),16)||0,b=parseInt(h.slice(5,7),16)||0;
  var p=pct/100,q=1-p;
  if(to==='transparent')return 'rgba('+r+','+g+','+b+','+p+')';
  var r2=255,g2=255,b2=255;
  if(to&&to[0]==='#'){r2=parseInt(to.slice(1,3),16)||0;g2=parseInt(to.slice(3,5),16)||0;b2=parseInt(to.slice(5,7),16)||0;}
  return 'rgb('+Math.round(r*p+r2*q)+','+Math.round(g*p+g2*q)+','+Math.round(b*p+b2*q)+')';
}

// stroke-dasharray attribute string for a given border style
function da(s){return s==='dashed'?' stroke-dasharray="8 4"':s==='dotted'?' stroke-dasharray="2 4"':'';}

// ── Handle positions ────────────────────────────────────────────────────
function hpos(ax,ay,w,h,handle,edges,nodeId,role){
  var b=(handle||'bottom').split('-')[0],dx=0,dy=0;
  if(b==='top')dy=-1;else if(b==='bottom')dy=1;else if(b==='left')dx=-1;else dx=1;
  var dash=handle?handle.indexOf('-'):-1;
  if(dash<0){
    var cx=ax+(b==='left'?0:b==='right'?w:w/2);
    var cy=ay+(b==='top'?0:b==='bottom'?h:h/2);
    return{x:cx,y:cy,dx:dx,dy:dy};
  }
  var idx=parseInt(handle.substring(dash+1),10)||0,count=0;
  for(var i=0;i<edges.length;i++){
    var e=edges[i];
    if(role==='s'&&e.source===nodeId&&(e.sourceHandle||'bottom').split('-')[0]===b)count++;
    else if(role==='t'&&e.target===nodeId&&(e.targetHandle||'top').split('-')[0]===b)count++;
  }
  count=Math.max(count,idx+1);
  var frac=(idx+1)/(count+1);
  var rx=ax+(b==='left'?0:b==='right'?w:w*frac);
  var ry=ay+(b==='top'?0:b==='bottom'?h:h*frac);
  return{x:rx,y:ry,dx:dx,dy:dy};
}

// ── Marker rendering ───────────────────────────────────────────────────
function mkr(px,py,dx,dy,type,color){
  if(!type||type==='none')return '';
  if(type.startsWith('crow-')){
    var ppx=-dy,ppy=dx,BH=7;
    var sw=' stroke="'+esc(color)+'" stroke-width="1.5" stroke-linecap="round"';
    var bar=function(d){var bx=px+d*dx,by=py+d*dy;return '<line x1="'+(bx+BH*ppx)+'" y1="'+(by+BH*ppy)+'" x2="'+(bx-BH*ppx)+'" y2="'+(by-BH*ppy)+'" fill="none"'+sw+'/>';};
    var fork=function(d0,d1){var bx=px+d0*dx,by=py+d0*dy,ex=px+d1*dx,ey=py+d1*dy;return '<line x1="'+bx+'" y1="'+by+'" x2="'+ex+'" y2="'+ey+'" fill="none"'+sw+'/><line x1="'+bx+'" y1="'+by+'" x2="'+(ex+BH*ppx)+'" y2="'+(ey+BH*ppy)+'" fill="none"'+sw+'/><line x1="'+bx+'" y1="'+by+'" x2="'+(ex-BH*ppx)+'" y2="'+(ey-BH*ppy)+'" fill="none"'+sw+'/>';};
    var circ2=function(d,r){return '<circle cx="'+(px+d*dx)+'" cy="'+(py+d*dy)+'" r="'+r+'" fill="none"'+sw+'/>';};
    if(type==='crow-one')return bar(5)+bar(11);
    if(type==='crow-many')return bar(5)+fork(5,12);
    if(type==='crow-zero-or-one')return circ2(9,4)+bar(15);
    if(type==='crow-zero-or-many')return circ2(9,4)+fork(14,20);
    return '';
  }
  var angle=Math.atan2(dy,dx),cos=Math.cos(angle),sin=Math.sin(angle),sz=8;
  var pts=[(px+sz*cos+sz*0.5*sin)+','+(py+sz*sin-sz*0.5*cos),px+','+py,(px+sz*cos-sz*0.5*sin)+','+(py+sz*sin+sz*0.5*cos)].join(' ');
  if(type==='arrowclosed')return '<polygon points="'+pts+'" fill="'+esc(color)+'" stroke="none"/>';
  if(type==='arrow')return '<polyline points="'+pts+'" fill="none" stroke="'+esc(color)+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  return '';
}

// ── Smoothstep / step path builder ────────────────────────────────────
function buildRoundedPath(pts,r){
  if(!pts.length)return '';
  var d='M '+pts[0].x+' '+pts[0].y;
  for(var i=1;i<pts.length-1;i++){
    var prev=pts[i-1],curr=pts[i],next=pts[i+1];
    var dx1=curr.x-prev.x,dy1=curr.y-prev.y,dx2=next.x-curr.x,dy2=next.y-curr.y;
    var l1=Math.sqrt(dx1*dx1+dy1*dy1),l2=Math.sqrt(dx2*dx2+dy2*dy2);
    if(r===0||l1<0.1||l2<0.1){d+=' L '+curr.x+' '+curr.y;continue;}
    var cr=Math.min(r,l1/2,l2/2);
    var t1x=curr.x-(dx1/l1)*cr,t1y=curr.y-(dy1/l1)*cr,t2x=curr.x+(dx2/l2)*cr,t2y=curr.y+(dy2/l2)*cr;
    d+=' L '+t1x+' '+t1y+' Q '+curr.x+' '+curr.y+' '+t2x+' '+t2y;
  }
  return d+' L '+pts[pts.length-1].x+' '+pts[pts.length-1].y;
}
function buildStepPath(sx,sy,sdx,sdy,tx,ty,tdx,tdy,br,cx,cy){
  var OFF=20,ex1=sx+sdx*OFF,ey1=sy+sdy*OFF,ex2=tx+tdx*OFF,ey2=ty+tdy*OFF;
  var mc=cx!=null?cx:(ex1+ex2)/2,md=cy!=null?cy:(ey1+ey2)/2;
  var hS=sdy===0,hT=tdy===0,corners;
  if(hS===hT)corners=hS?[{x:mc,y:ey1},{x:mc,y:ey2}]:[{x:ex1,y:md},{x:ex2,y:md}];
  else if(hS)corners=[{x:ex2,y:ey1}];
  else corners=[{x:ex1,y:ey2}];
  var pts=[{x:sx,y:sy},{x:ex1,y:ey1}].concat(corners).concat([{x:ex2,y:ey2},{x:tx,y:ty}]);
  var dd=[pts[0]];
  for(var i=1;i<pts.length;i++){if(Math.abs(pts[i].x-dd[dd.length-1].x)>0.1||Math.abs(pts[i].y-dd[dd.length-1].y)>0.1)dd.push(pts[i]);}
  return{d:buildRoundedPath(dd,br),lx:mc,ly:md};
}

// ── Text wrapping ──────────────────────────────────────────────────────
function wrap(text,maxW,fs){
  var chars=Math.floor(maxW/(fs*0.6)),words=(text||'').split(' '),lines=[],line='';
  for(var i=0;i<words.length;i++){
    var t=line?line+' '+words[i]:words[i];
    if(t.length>chars&&line){lines.push(line);line=words[i];}else line=t;
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
}

// ── Lucide icon paths (24×24 viewBox, stroke icons) ────────────────────
// Paths taken from lucide-svelte v0.575.0 (same version used in the app)
function iconPaths(type){
  if(type==='service')return '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>';
  if(type==='queue')return '<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>';
  if(type==='api')return '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="2" y1="12" x2="22" y2="12"/>';
  if(type==='user')return '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
  if(type==='workflow')return '<rect x="3" y="3" width="8" height="8" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect x="13" y="13" width="8" height="8" rx="2"/>';
  // Default: generic rectangle — process, and any unknown card types
  return '<rect x="3" y="3" width="18" height="18" rx="2"/>';
}
// Render an 11×11 icon at SVG coordinate (x, y)
function renderIcon(type,x,y,color){
  return '<svg x="'+x+'" y="'+y+'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="'+esc(color)+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'+iconPaths(type)+'</svg>';
}

// ── Node renderers ─────────────────────────────────────────────────────
function renderNode(node,ax,ay){
  var w=node.size.width,h=node.size.height;
  var st=node.style||{};
  var type=node.type,label=node.label||'';
  var nid=node.id.replace(/[^a-z0-9]/gi,'');
  // ClipPath clips children to rounded card shape (rx=8)
  var clip='<clipPath id="c'+nid+'"><rect width="'+w+'" height="'+h+'" rx="8" ry="8"/></clipPath>';

  // ── group ──────────────────────────────────────────────────────────
  if(type==='group'){
    var gbdColor=st.borderColor||MUT;
    // fill uses transparent blend (not white) to match GroupNode.svelte bodyBg
    var gbgColor=st.backgroundColor||blend(gbdColor,'transparent',5);
    var gbdStyle=st.borderStyle||'dashed';
    var gbda=gbdStyle==='dashed'?' stroke-dasharray="8 4"':gbdStyle==='dotted'?' stroke-dasharray="2 4"':'';
    var gbNone=gbdStyle==='none';
    var gbStroke=gbNone?'stroke="none"':'stroke="'+esc(gbdColor)+'" stroke-width="2"'+gbda;
    // header: transparent blend (matches headerBg = color-mix(accentColor 8%, transparent))
    var GHH=28,ghBg=blend(gbdColor,'transparent',8);
    // header text color: borderColor if custom, else secondary text (#4b5563)
    var ghText=st.borderColor?esc(gbdColor):SEC;
    return '<g transform="translate('+ax+','+ay+')">'
      +'<defs>'+clip+'</defs>'
      +'<rect width="'+w+'" height="'+h+'" rx="8" ry="8" fill="'+esc(gbgColor)+'" '+gbStroke+'/>'
      +'<rect width="'+w+'" height="'+GHH+'" fill="'+esc(ghBg)+'" clip-path="url(#c'+nid+')"/>'
      +'<text x="12" y="14" dominant-baseline="middle" font-family="'+F+'" font-size="12" font-weight="700" fill="'+esc(ghText)+'" clip-path="url(#c'+nid+')">'+esc(label||'Group')+'</text>'
      +'</g>';
  }

  // ── text ──────────────────────────────────────────────────────────
  if(type==='text'){
    var tFs=parseInt(st.fontSize||'14',10)||14;
    var tColor=st.borderColor||TXT;
    var tBStyle=st.borderStyle||'none';
    var tLines=wrap(label,w-24,tFs);
    var tLH=tFs*1.375,tTotalH=tLines.length*tLH,tY0=(h-tTotalH)/2+(tLH/2);
    var tBorder='';
    if(tBStyle!=='none')tBorder='<rect width="'+w+'" height="'+h+'" rx="4" fill="none" stroke="'+esc(st.borderColor||BOR)+'" stroke-width="1.5"'+da(tBStyle)+'/>';
    return '<g transform="translate('+ax+','+ay+')">'+tBorder
      +tLines.map(function(l,i){return '<text x="'+(w/2)+'" y="'+(tY0+i*tLH)+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="'+tFs+'" fill="'+esc(tColor)+'">'+esc(l)+'</text>';}).join('')
      +'</g>';
  }

  // Shared computed values for all remaining types
  var typeColor=NC[type]||'#3b82f6';
  var effectiveColor=st.borderColor||typeColor;
  var bStyle=st.borderStyle||'solid';
  var bNone=bStyle==='none';
  var bda=da(bStyle);
  // fill: color-mix(effectiveColor 8%, white) — matching all shape/card Svelte components
  var shapeFill=blend(effectiveColor,'white',8);
  // stroke: color-mix(effectiveColor 40%, --color-border-primary) — exact formula from components
  var shapeStroke=blend(effectiveColor,BOR,40);

  // ── decision (diamond via polygon) ────────────────────────────────
  // DecisionNode: rotated 72% inner box → produces full-size diamond visually
  if(type==='decision'){
    var dStroke=bNone?'stroke="none"':'stroke="'+shapeStroke+'" stroke-width="1.5"'+bda;
    var dLines=wrap(label,w*0.55,12),dLH=16,dLY=(h/2)-((dLines.length-1)*dLH/2);
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
      +'<polygon points="'+(w/2)+',0 '+w+','+(h/2)+' '+(w/2)+','+h+' 0,'+(h/2)+'" fill="'+shapeFill+'" '+dStroke+'/>'
      +dLines.map(function(l,i){return '<text x="'+(w/2)+'" y="'+(dLY+i*dLH)+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="12" font-weight="500" fill="'+TXT+'">'+esc(l)+'</text>';}).join('')
      +'</g>';
  }

  // ── terminal (pill shape — rounded-full border) ────────────────────
  // TerminalNode: rounded-full div → rx = h/2
  if(type==='terminal'){
    var tStroke2=bNone?'stroke="none"':'stroke="'+shapeStroke+'" stroke-width="1.5"'+bda;
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
      +'<rect width="'+w+'" height="'+h+'" rx="'+(h/2)+'" fill="'+shapeFill+'" '+tStroke2+'/>'
      +'<text x="'+(w/2)+'" y="'+(h/2)+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="14" font-weight="500" fill="'+TXT+'">'+esc(label)+'</text>'
      +'</g>';
  }

  // ── io (parallelogram) ────────────────────────────────────────────
  // IONode SVG: viewBox "0 0 150 48", polygon "20,0 150,0 130,48 0,48"
  // Left offset = 20/150 of width; text offset matches padding-left:16px in component
  if(type==='io'){
    var ioStroke=bNone?'stroke="none"':'stroke="'+shapeStroke+'" stroke-width="1.5"'+bda;
    var sk=Math.round(w*20/150);
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
      +'<polygon points="'+sk+',0 '+w+',0 '+(w-sk)+','+h+' 0,'+h+'" fill="'+shapeFill+'" '+ioStroke+'/>'
      +'<text x="'+(w/2)+'" y="'+(h/2)+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="14" font-weight="500" fill="'+TXT+'">'+esc(label)+'</text>'
      +'</g>';
  }

  // ── document (wavy bottom) ────────────────────────────────────────
  // DocumentNode SVG: viewBox "0 0 150 56", path "M 0 0 L 150 0 L 150 42 Q 112 56 75 42 Q 38 28 0 42 Z"
  // Wave starts at 42/56=75% of height; text centered in upper 75% with padding-bottom:8px
  if(type==='document'){
    var docStroke=bNone?'stroke="none"':'stroke="'+shapeStroke+'" stroke-width="1.5"'+bda;
    var wY=Math.round(h*0.75);
    var docDp='M 0 0 L '+w+' 0 L '+w+' '+wY
      +' Q '+Math.round(w*0.747)+' '+h+' '+(w/2)+' '+wY
      +' Q '+Math.round(w*0.253)+' '+Math.round(h*0.5)+' 0 '+wY+' Z';
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
      +'<path d="'+docDp+'" fill="'+shapeFill+'" '+docStroke+'/>'
      +'<text x="'+(w/2)+'" y="'+(wY/2)+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="14" font-weight="500" fill="'+TXT+'">'+esc(label)+'</text>'
      +'</g>';
  }

  // ── database (cylinder) ──────────────────────────────────────────
  // DatabaseNode SVG: viewBox "0 0 120 72"
  // Top ellipse cy=12, ry=10 → ery = h*10/72; bottom at h-ery
  if(type==='database'){
    var dbStroke=bNone?'stroke="none"':'stroke="'+shapeStroke+'" stroke-width="1.5"'+bda;
    var ery=Math.max(Math.round(h*10/72),5);
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
      +'<defs>'+clip+'</defs>'
      // Body rectangle (sides covered by lines below)
      +'<rect x="1.5" y="'+ery+'" width="'+(w-3)+'" height="'+(h-ery*2)+'" fill="'+shapeFill+'"/>'
      // Bottom ellipse
      +'<ellipse cx="'+(w/2)+'" cy="'+(h-ery)+'" rx="'+(w/2-1.5)+'" ry="'+ery+'" fill="'+shapeFill+'" '+dbStroke+'/>'
      // Side lines
      +'<line x1="1.5" y1="'+ery+'" x2="1.5" y2="'+(h-ery)+'" '+dbStroke+'/>'
      +'<line x1="'+(w-1.5)+'" y1="'+ery+'" x2="'+(w-1.5)+'" y2="'+(h-ery)+'" '+dbStroke+'/>'
      // Top ellipse drawn last (on top) to show full stroke
      +'<ellipse cx="'+(w/2)+'" cy="'+ery+'" rx="'+(w/2-1.5)+'" ry="'+ery+'" fill="'+shapeFill+'" '+dbStroke+'/>'
      +'<text x="'+(w/2)+'" y="'+(h/2)+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="14" font-weight="500" fill="'+TXT+'" clip-path="url(#c'+nid+')">'+esc(label)+'</text>'
      +'</g>';
  }

  // ── entity (ERD table) ───────────────────────────────────────────
  // EntityNode: gradient header (transparent blend), grid icon, fields table
  if(type==='entity'){
    var fields=Array.isArray(node.data&&node.data.fields)?node.data.fields:[];
    // Entity always uses NC.entity color — no customStyle override in component
    var eColor=NC.entity;
    // Header height: px-2.5(10) + py-1.5(6+6) + text-sm line-height(~20) ≈ 32px
    var EHH=32,RH=22;
    var ehgId='ehg'+nid;
    // Header gradient: linear-gradient(135deg, color-mix(color 10%, transparent), color-mix(color 4%, transparent))
    var ehgS=blend(eColor,'transparent',10),ehgE=blend(eColor,'transparent',4);
    var inner='<defs>'+clip
      +'<linearGradient id="'+ehgId+'" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">'
      +'<stop offset="0" stop-color="'+ehgS+'"/><stop offset="1" stop-color="'+ehgE+'"/>'
      +'</linearGradient></defs>'
      +'<rect width="'+w+'" height="'+h+'" rx="8" ry="8" fill="'+BG+'" stroke="'+BOR+'" stroke-width="1"/>'
      +'<rect width="'+w+'" height="'+EHH+'" fill="url(#'+ehgId+')" clip-path="url(#c'+nid+')"/>'
      +'<line x1="0" y1="'+EHH+'" x2="'+w+'" y2="'+EHH+'" stroke="'+SUB+'" stroke-width="1"/>'
      // Grid icon: same SVG as EntityNode.svelte, 11×11 at viewBox "0 0 12 12"
      +'<svg x="10" y="'+((EHH-11)/2)+'" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="'+esc(eColor)+'" stroke-width="1.2" stroke-linecap="round">'
      +'<rect x="0.5" y="0.5" width="11" height="11" rx="1.5"/>'
      +'<line x1="0.5" y1="4" x2="11.5" y2="4"/>'
      +'<line x1="4.5" y1="4" x2="4.5" y2="11.5"/>'
      +'</svg>'
      // Label: text-sm font-semibold, entity color; x=27 (px-2.5=10 + icon=11 + gap-1.5=6)
      +'<text x="27" y="'+(EHH/2)+'" dominant-baseline="middle" font-family="'+F+'" font-size="14" font-weight="700" fill="'+esc(eColor)+'" clip-path="url(#c'+nid+')">'+esc(label)+'</text>';
    var visF=Math.min(fields.length,Math.max(0,Math.floor((h-EHH)/RH)));
    for(var fi=0;fi<visF;fi++){
      var f=fields[fi],fy=EHH+fi*RH,mid=fy+RH/2;
      if(fi>0)inner+='<line x1="0" y1="'+fy+'" x2="'+w+'" y2="'+fy+'" stroke="'+SUB+'" stroke-width="0.5"/>';
      var ks=f.key&&KB[f.key];
      if(ks){
        // Badge: px-2=8 offset, 26px column width → badge rect ~20px wide centered in column
        inner+='<rect x="8" y="'+(mid-7)+'" width="20" height="14" rx="2" fill="'+ks.bg+'"/>'
          +'<text x="18" y="'+mid+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="8" font-weight="700" fill="'+ks.tx+'">'+esc(String(f.key).toUpperCase())+'</text>';
      }
      // Field name: starts after badge column (px-2=8 + col=26 + gap-1=4 = 38)
      inner+='<text x="38" y="'+mid+'" dominant-baseline="middle" font-family="'+F+'" font-size="12" fill="'+TXT+'" clip-path="url(#c'+nid+')">'+esc(f.name||'')+'</text>';
      // Field type: right-aligned, monospace, 10px, text-muted
      inner+='<text x="'+(w-8)+'" y="'+mid+'" text-anchor="end" dominant-baseline="middle" font-family="'+FM+'" font-size="10" fill="'+MUT+'" clip-path="url(#c'+nid+')">'+esc(f.type||'')+'</text>';
    }
    if(!fields.length)inner+='<text x="10" y="'+(EHH+14)+'" font-family="'+F+'" font-size="12" fill="'+MUT+'">No fields</text>';
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'+inner+'</g>';
  }

  // ── workflow ──────────────────────────────────────────────────────
  // WorkflowNode: rounded border, icon box (TYPE color), label, status dot
  if(type==='workflow'){
    var wfStatus=(node.data&&node.data.status)||'idle';
    var wfDot={idle:MUT,running:'#f59e0b',success:'#22c55e',error:'#ef4444'}[wfStatus]||MUT;
    var wfStroke=bNone?'stroke="none"':'stroke="'+shapeStroke+'" stroke-width="1"'+bda;
    // Icon box background: color-mix(typeColor 25%, transparent) — uses TYPE color, not effective
    var wfIbg=blend(typeColor,'transparent',25);
    var wfIbY=(h-20)/2;
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
      +'<defs>'+clip+'</defs>'
      +'<rect width="'+w+'" height="'+h+'" rx="8" fill="'+shapeFill+'" '+wfStroke+'/>'
      // Icon box: px-3(12) from left, centered vertically
      +'<rect x="12" y="'+wfIbY+'" width="20" height="20" rx="4" fill="'+wfIbg+'"/>'
      +renderIcon('workflow',16.5,wfIbY+4.5,typeColor)
      // Label: x=40 (px-3=12 + icon=20 + gap-2=8), text-sm font-medium
      +'<text x="40" y="'+(h/2)+'" dominant-baseline="middle" font-family="'+F+'" font-size="14" font-weight="500" fill="'+TXT+'" clip-path="url(#c'+nid+')">'+esc(label)+'</text>'
      // Status dot: h-2 w-2 (8px) at right end (px-3=12 from right + 4 = 16)
      +'<circle cx="'+(w-16)+'" cy="'+(h/2)+'" r="4" fill="'+esc(wfDot)+'"/>'
      +'</g>';
  }

  // ── shape-rect ────────────────────────────────────────────────────
  // ShapeRectNode: rounded-md (4px radius), fill/stroke with customStyle overrides
  if(type==='shape-rect'){
    var srFill=st.backgroundColor||shapeFill;
    var srBorder=bNone?'stroke="none"':'stroke="'+(st.borderColor?esc(st.borderColor):shapeStroke)+'" stroke-width="1.5"'+bda;
    var srFs=parseInt(st.fontSize||'14',10)||14;
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
      +'<defs>'+clip+'</defs>'
      +'<rect width="'+w+'" height="'+h+'" rx="4" fill="'+esc(srFill)+'" '+srBorder+'/>'
      +'<text x="'+(w/2)+'" y="'+(h/2)+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="'+srFs+'" font-weight="500" fill="'+TXT+'" clip-path="url(#c'+nid+')">'+esc(label)+'</text>'
      +'</g>';
  }

  // ── shape-circle ──────────────────────────────────────────────────
  // ShapeCircleNode: rounded-full — circle inscribed in the node box
  if(type==='shape-circle'){
    var scR=Math.min(w,h)/2;
    var scFill=st.backgroundColor||shapeFill;
    var scBorder=bNone?'stroke="none"':'stroke="'+(st.borderColor?esc(st.borderColor):shapeStroke)+'" stroke-width="1.5"'+bda;
    var scFs=parseInt(st.fontSize||'14',10)||14;
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
      +'<circle cx="'+(w/2)+'" cy="'+(h/2)+'" r="'+scR+'" fill="'+esc(scFill)+'" '+scBorder+'/>'
      +'<text x="'+(w/2)+'" y="'+(h/2)+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="'+scFs+'" font-weight="500" fill="'+TXT+'">'+esc(label)+'</text>'
      +'</g>';
  }

  // ── shape-diamond ─────────────────────────────────────────────────
  // ShapeDiamondNode SVG: polygon "50,2 98,50 50,98 2,50" in viewBox 100×100
  if(type==='shape-diamond'){
    var sdFill=st.backgroundColor||shapeFill;
    var sdBorder=bNone?'stroke="none"':'stroke="'+(st.borderColor?esc(st.borderColor):shapeStroke)+'" stroke-width="2"'+bda;
    var sdFs=parseInt(st.fontSize||'14',10)||14;
    return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
      +'<polygon points="'+(w/2)+',2 '+(w-2)+','+(h/2)+' '+(w/2)+','+(h-2)+' 2,'+(h/2)+'" fill="'+esc(sdFill)+'" '+sdBorder+'/>'
      +'<text x="'+(w/2)+'" y="'+(h/2)+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="'+sdFs+'" font-weight="500" fill="'+TXT+'">'+esc(label)+'</text>'
      +'</g>';
  }

  // ── card nodes: process, service, queue, api, user (and unknown types) ──
  // BaseNode layout: header (36px) + optional description below
  // Header: py-2(8+8) + h-5 icon(20) = 36px; gradient 135deg from 12% to 4% of effectiveColor
  var HH=36;
  var cardBg=st.backgroundColor||BG;
  var cardBorder=st.borderColor||BOR;
  var cardBdAttr=bNone?'stroke="none"':'stroke="'+esc(cardBorder)+'" stroke-width="1"'+bda;
  var hgId='hg'+nid;
  // gradient: color-mix(effectiveColor 12%, white) → color-mix(effectiveColor 4%, white)
  var hgS=blend(effectiveColor,'white',12),hgE=blend(effectiveColor,'white',4);
  // icon box uses TYPE color (not effectiveColor) — matches BaseNode icon div
  var ibBg=blend(typeColor,'transparent',25);
  // Description text
  var desc=node.description||'';
  var dLines=[];
  if(desc)desc.split('\\n').forEach(function(raw){if(raw.trim())dLines=dLines.concat(wrap(raw.trim(),w-24,12));});
  var dLH=16,maxD=Math.max(0,Math.floor((h-HH-6)/dLH));
  var dSvg=dLines.slice(0,maxD).map(function(l,i){
    // py-1.5(6) padding-top + 8px half-line-height → first line at y = HH+6+8 = HH+14
    return '<text x="12" y="'+(HH+14+i*dLH)+'" dominant-baseline="middle" font-family="'+F+'" font-size="12" fill="'+MUT+'" clip-path="url(#c'+nid+')">'+esc(l)+'</text>';
  }).join('');

  return '<g transform="translate('+ax+','+ay+')" filter="url(#ds)">'
    +'<defs>'+clip
    +'<linearGradient id="'+hgId+'" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">'
    +'<stop offset="0" stop-color="'+hgS+'"/><stop offset="1" stop-color="'+hgE+'"/>'
    +'</linearGradient></defs>'
    // Card body: white background, rounded, 1px border
    +'<rect width="'+w+'" height="'+h+'" rx="8" ry="8" fill="'+esc(cardBg)+'" '+cardBdAttr+'/>'
    // Header gradient (clipped to card shape)
    +'<rect width="'+w+'" height="'+HH+'" fill="url(#'+hgId+')" clip-path="url(#c'+nid+')"/>'
    // Separator line below header (--color-border-subtle = #f3f4f6)
    +'<line x1="0" y1="'+HH+'" x2="'+w+'" y2="'+HH+'" stroke="'+SUB+'" stroke-width="1"/>'
    // Icon box: h-5 w-5 (20×20), rounded (4px), at px-3 (12px from left), centered in header
    +'<rect x="12" y="8" width="20" height="20" rx="4" fill="'+ibBg+'"/>'
    // Icon SVG centered in icon box: 16.5, 12.5 (12+4.5, 8+4.5)
    +renderIcon(type,16.5,12.5,typeColor)
    // Label: text-sm font-semibold (14px, 700), color: --color-text-primary; x=40 (12+20+8)
    +'<text x="40" y="'+(HH/2)+'" dominant-baseline="middle" font-family="'+F+'" font-size="14" font-weight="700" fill="'+TXT+'" clip-path="url(#c'+nid+')">'+esc(label)+'</text>'
    +dSvg
    +'</g>';
}

// ── Edge renderer ──────────────────────────────────────────────────────
// ox/oy: the translation applied to all node positions (PAD - minX/minY).
// centerX/centerY on edges are in flow-coordinate space (same as node positions),
// so they must be shifted by the same offset before use in the SVG coordinate space.
function renderEdge(e,nodeAbs,edges,ox,oy){
  var sn=nodeAbs[e.source],tn=nodeAbs[e.target];
  if(!sn||!tn)return '';
  var s=hpos(sn.x,sn.y,sn.w,sn.h,e.sourceHandle||'bottom',edges,e.source,'s');
  var t=hpos(tn.x,tn.y,tn.w,tn.h,e.targetHandle||'top',edges,e.target,'t');
  var cx=e.centerX!=null?e.centerX+ox:undefined;
  var cy=e.centerY!=null?e.centerY+oy:undefined;
  var etype=e.type||'smoothstep',d,lx=(s.x+t.x)/2,ly=(s.y+t.y)/2;
  if(etype==='straight'){
    d='M '+s.x+' '+s.y+' L '+t.x+' '+t.y;
  }else if(etype==='bezier'||etype==='labeled'||etype==='animated'){
    var dist=Math.sqrt(Math.pow(t.x-s.x,2)+Math.pow(t.y-s.y,2));
    var off=Math.max(35,Math.min(120,dist*0.42));
    d='M '+s.x+' '+s.y+' C '+(s.x+s.dx*off)+' '+(s.y+s.dy*off)+', '+(t.x+t.dx*off)+' '+(t.y+t.dy*off)+', '+t.x+' '+t.y;
  }else if(etype==='step'){
    var sp0=buildStepPath(s.x,s.y,s.dx,s.dy,t.x,t.y,t.dx,t.dy,0,cx,cy);
    d=sp0.d;lx=sp0.lx;ly=sp0.ly;
  }else{
    var sp1=buildStepPath(s.x,s.y,s.dx,s.dy,t.x,t.y,t.dx,t.dy,8,cx,cy);
    d=sp1.d;lx=sp1.lx;ly=sp1.ly;
  }
  var sc=e.strokeColor||EDG,sw=e.strokeWidth||1.5,ss=e.strokeStyle||'solid';
  var eda=ss==='dashed'?' stroke-dasharray="8 4"':ss==='dotted'?' stroke-dasharray="2 4"':'';
  var isAnim=e.animated||etype==='animated';
  var ecls=isAnim?' class="ea"':'';
  if(isAnim&&!eda)eda=' stroke-dasharray="5 5"';
  var parts=['<path d="'+d+'"'+ecls+' fill="none" stroke="'+esc(sc)+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round"'+eda+'/>'];
  var me=e.markerEnd!=null?e.markerEnd:'arrowclosed';
  var ms=e.markerStart;
  if(me!=='none')parts.push(mkr(t.x,t.y,t.dx,t.dy,me,sc));
  if(ms&&ms!=='none')parts.push(mkr(s.x,s.y,s.dx,s.dy,ms,sc));
  if(e.label){
    var lw=String(e.label).length*6.5+16;
    parts.push('<rect x="'+(lx-lw/2)+'" y="'+(ly-10)+'" width="'+lw+'" height="20" rx="5" fill="'+BG+'" stroke="'+BOR+'" stroke-width="1"/>');
    parts.push('<text x="'+lx+'" y="'+ly+'" text-anchor="middle" dominant-baseline="middle" font-family="'+F+'" font-size="11" fill="'+SEC+'">'+esc(e.label)+'</text>');
  }
  return parts.join('');
}

// ── Main render function ───────────────────────────────────────────────
function renderDiagram(diag,renderId){
  var nodes=diag.nodes||[],edges=diag.edges||[],PAD=48;
  var nodeMap={};
  nodes.forEach(function(n){nodeMap[n.id]=n;});
  // Resolve absolute positions (handles child nodes inside groups)
  var absCache={};
  function getAbs(n){
    if(absCache[n.id])return absCache[n.id];
    var ax=n.position.x,ay=n.position.y;
    if(n.parentId&&nodeMap[n.parentId]){var p=getAbs(nodeMap[n.parentId]);ax+=p.x;ay+=p.y;}
    return(absCache[n.id]={x:ax,y:ay});
  }
  nodes.forEach(function(n){getAbs(n);});
  // Canvas bounds from ALL nodes (including groups) to prevent clipping
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  nodes.forEach(function(n){
    var p=absCache[n.id];
    minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x+n.size.width);maxY=Math.max(maxY,p.y+n.size.height);
  });
  if(!isFinite(minX)){minX=0;minY=0;maxX=400;maxY=300;}
  var W=Math.round(maxX-minX+PAD*2),H=Math.round(maxY-minY+PAD*2);
  var ox=PAD-minX,oy=PAD-minY;
  var nodeAbs={};
  nodes.forEach(function(n){var p=absCache[n.id];nodeAbs[n.id]={x:p.x+ox,y:p.y+oy,w:n.size.width,h:n.size.height};});
  // Use unique filter id per diagram to avoid collisions in multi-diagram exports
  var fid='ds'+renderId.replace(/[^a-z0-9]/gi,'');
  var parts=[
    '<defs><filter id="'+fid+'" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.08)"/></filter></defs>'
  ];
  // Render order: groups first (background), then edges, then non-group nodes
  var groups=nodes.filter(function(n){return n.type==='group';});
  var nonGroups=nodes.filter(function(n){return n.type!=='group';});
  groups.forEach(function(n){var p=absCache[n.id];parts.push(renderNode(n,p.x+ox,p.y+oy));});
  edges.forEach(function(e){parts.push(renderEdge(e,nodeAbs,edges,ox,oy));});
  nonGroups.forEach(function(n){var p=absCache[n.id];parts.push(renderNode(n,p.x+ox,p.y+oy));});
  // Replace placeholder filter refs with the actual unique filter id
  var body=parts.filter(Boolean).join('\\n').replace(/filter="url\\(#ds\\)"/g,'filter="url(#'+fid+')"');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="max-width:100%;height:auto;display:block">'+body+'</svg>';
}

// ── Bootstrap ──────────────────────────────────────────────────────────
document.querySelectorAll('script[data-diag]').forEach(function(s){
  var id=s.getAttribute('data-diag');
  var target=document.getElementById('di-'+id);
  if(!target)return;
  try{
    var diag=JSON.parse(s.textContent||'{}');
    target.innerHTML=renderDiagram(diag,id);
  }catch(err){
    target.innerHTML='<p style="color:#ef4444;padding:20px;font-size:13px">Render error: '+esc(String(err))+'</p>';
  }
});
})();`;

export const RENDERER_SCRIPT = `${RENDERER_CSS}<script>${RENDERER_IIFE}<\/script>`;
