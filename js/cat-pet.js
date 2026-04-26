(function CatPet() {
  var cvs = document.createElement('canvas');
  cvs.width = 180; cvs.height = 180;
  document.body.appendChild(cvs);
  var ctx = cvs.getContext('2d');

  var posX = window.innerWidth - 120;
  var posY = window.innerHeight - 90;
  cvs.style.cssText = 'position:fixed;z-index:100;cursor:grab;pointer-events:auto;';
  function setPos() {
    cvs.style.left = (posX - 90) + 'px';
    cvs.style.top = (posY - 145) + 'px';
  }
  setPos();

  var G  = '#7B8FA1', GL = '#8E9FAE', GD = '#6A7D8E';
  var W  = '#F5F0EB', PW = '#FFF';
  var AMB = '#D4943A', PUP = '#1A1A1A';
  var PNK = '#E8A0A0', EAR = '#E8C4C4', MTH = '#C48888', TNG = '#E89090';
  var BLU = 'rgba(232,160,160,0.25)', HRT = '#E88A8A';

  var state = 'sit', stateT = 0, stateDur = 3000;
  var lastF = performance.now();
  var eyeOpen = 1, blinkT = 0, nextBlink = 2500 + Math.random() * 3000;
  var mx = -9999, my = -9999;
  var isDrag = false, dragMoved = false, dragOX = 0, dragOY = 0;
  var hearts = [], zzzs = [];
  var petT = 0, tailPh = 0, walkDir = 1;

  function ell(cx,cy,rx,ry,c,a) {
    ctx.save(); ctx.translate(cx,cy); if(a) ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
    ctx.fillStyle = c; ctx.fill(); ctx.restore();
  }
  function cir(cx,cy,r,c) {
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle = c; ctx.fill();
  }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function getLook() {
    var r = cvs.getBoundingClientRect();
    var dx = mx - (r.left+90), dy = my - (r.top+55);
    var d = Math.sqrt(dx*dx+dy*dy);
    if (d > 400) return {x:0, y:0.1};
    var f = Math.min(1, d/150);
    return {x: (dx/(d||1))*f, y: (dy/(d||1))*f};
  }

  function drawEar(x,y,ang) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-10,-18); ctx.lineTo(10,-18); ctx.closePath();
    ctx.fillStyle = G; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,-3); ctx.lineTo(-6,-15); ctx.lineTo(6,-15); ctx.closePath();
    ctx.fillStyle = EAR; ctx.fill();
    ctx.restore();
  }

  function drawEye(cx,cy,lx,ly,open) {
    if (open < 0.1) {
      ctx.beginPath(); ctx.moveTo(cx-6,cy); ctx.quadraticCurveTo(cx,cy-4,cx+6,cy);
      ctx.strokeStyle = PUP; ctx.lineWidth = 1.5; ctx.stroke(); return;
    }
    var ry = 7 * open;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx,cy,7,ry,0,0,Math.PI*2);
    ctx.fillStyle = PW; ctx.fill(); ctx.clip();
    var mx2 = 3, ix = cx + lx*mx2, iy = cy + ly*mx2*0.5;
    cir(ix,iy,5,AMB); cir(ix,iy,2.5,PUP); cir(ix-1.5,iy-2,1.5,'rgba(255,255,255,0.85)');
    ctx.restore();
  }

  function drawTail(bx,by,ph,flip) {
    var d = flip ? -1 : 1, w = Math.sin(ph)*12;
    ctx.strokeStyle = G; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx,by);
    ctx.bezierCurveTo(bx+d*25,by-10+w, bx+d*35,by-35+w*0.5, bx+d*28,by-50+w*0.3);
    ctx.stroke();
    ctx.strokeStyle = W; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(bx+d*31,by-44+w*0.35);
    ctx.quadraticCurveTo(bx+d*29,by-48+w*0.3, bx+d*28,by-50+w*0.3);
    ctx.stroke();
  }

  function drawBody(cx,cy,rx,ry,a) {
    ctx.save(); ctx.translate(cx,cy); if(a) ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
    ctx.fillStyle = G; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0,-ry*0.15,rx*0.58,ry*0.68,0,0,Math.PI*2);
    ctx.fillStyle = W; ctx.fill();
    ctx.restore();
  }

  function drawPaw(cx,cy,white) {
    ell(cx,cy,9,7,white?W:G);
    if (white) { cir(cx-3,cy+1,1.5,PNK); cir(cx+3,cy+1,1.5,PNK); cir(cx,cy+2.5,1.5,PNK); }
  }

  function drawWhiskers() {
    ctx.strokeStyle = 'rgba(140,140,140,0.35)'; ctx.lineWidth = 0.7;
    var pts = [[-32,0],[-30,-6],[-30,6],[32,0],[30,-6],[30,6]];
    for (var i=0;i<pts.length;i++) {
      ctx.beginPath();
      ctx.moveTo(pts[i][0]>0?8:-8, 8);
      ctx.lineTo(pts[i][0], 8+pts[i][1]);
      ctx.stroke();
    }
  }

  function drawHead(cx,cy,tilt,lx,ly,eo,mo,tongue) {
    ctx.save(); ctx.translate(cx,cy); if(tilt) ctx.rotate(tilt);
    drawEar(-20,-27,-0.3); drawEar(20,-27,0.3);
    cir(0,0,32,G);
    ctx.beginPath(); ctx.moveTo(0,-22);
    ctx.bezierCurveTo(-20,-8,-18,14,0,24);
    ctx.bezierCurveTo(18,14,20,-8,0,-22);
    ctx.fillStyle = W; ctx.fill();
    drawEye(-11,-3,lx,ly,eo); drawEye(11,-3,lx,ly,eo);
    cir(-19,6,6,BLU); cir(19,6,6,BLU);
    ctx.beginPath(); ctx.moveTo(0,6); ctx.lineTo(-3.5,10); ctx.lineTo(3.5,10); ctx.closePath();
    ctx.fillStyle = PNK; ctx.fill();
    if (mo > 0.1) {
      ctx.beginPath(); ctx.ellipse(0,14,6*mo,5*mo,0,0,Math.PI*2);
      ctx.fillStyle = '#C47878'; ctx.fill();
      if (tongue) { ctx.beginPath(); ctx.ellipse(0,16,3,2.5,0,0,Math.PI); ctx.fillStyle=TNG; ctx.fill(); }
    } else {
      ctx.strokeStyle = MTH; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0,11); ctx.quadraticCurveTo(-5,15,-8,13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,11); ctx.quadraticCurveTo(5,15,8,13); ctx.stroke();
    }
    drawWhiskers();
    ctx.restore();
  }

  function drawSitting(t) {
    var lk = getLook(); tailPh += 0.02;
    drawTail(120,130,tailPh,false);
    drawBody(90,120,30,24);
    drawPaw(68,143,true); drawPaw(112,143,false);
    drawHead(90,72,0,lk.x,lk.y,eyeOpen,0);
  }

  function drawStretching(t) {
    var lk = getLook(); tailPh += 0.03;
    var s = t<0.3?t/0.3:t<0.7?1:1-(t-0.7)/0.3; s = smooth(s);
    var sx=s*20, dip=s*8;
    drawTail(120+sx*0.3,130,tailPh,false);
    ctx.save(); ctx.translate(90-sx*0.3,120+dip); ctx.rotate(s*-0.12);
    ctx.beginPath(); ctx.ellipse(0,0,30+sx*0.3,22-dip*0.2,0,0,Math.PI*2); ctx.fillStyle=G; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0,-4,18,16,0,0,Math.PI*2); ctx.fillStyle=W; ctx.fill();
    ctx.restore();
    drawPaw(68-sx,143+dip*0.5,true); drawPaw(80-sx,145+dip*0.5,false); drawPaw(112,143,false);
    drawHead(90-sx*0.5,72+s*6,s*-0.08,lk.x,lk.y,(t>0.3&&t<0.7)?0.35:eyeOpen,0);
  }

  function drawLicking(t) {
    tailPh += 0.02;
    var s = t<0.15?t/0.15:t<0.8?1:1-(t-0.8)/0.2; s = smooth(s);
    drawTail(120,130,tailPh,false);
    drawBody(90,120,30,24);
    drawPaw(68,143,true);
    if (s>0.1) { drawPaw(112-s*30,143-s*60,false); } else { drawPaw(112,143,false); }
    var licking = t>0.15&&t<0.8;
    var tng = licking && Math.sin(t*40)>0;
    drawHead(90,72,s*0.15,0.3,0.3,licking?0.45:eyeOpen,tng?0.15:0,tng);
  }

  function drawRolling(t) {
    tailPh += 0.04;
    var ang = t<0.25?(t/0.25)*1.25 : t<0.5?1.25+Math.sin((t-0.25)*20)*0.15 : t<0.75?1.25*(1-(t-0.5)/0.25) : 0;
    var wig = (t>0.25&&t<0.5)?Math.sin(t*30)*3:0;
    ctx.save(); ctx.translate(90,120); ctx.rotate(ang); ctx.translate(-90,-120);
    drawTail(120,130,tailPh,false);
    drawBody(90,120,30,24);
    if (t>0.2&&t<0.6) {
      drawPaw(65,100+wig,true); drawPaw(115,95+wig,false);
      drawPaw(72,105-wig,true); drawPaw(108,108-wig,false);
    } else { drawPaw(68,143,true); drawPaw(112,143,false); }
    drawHead(90,72+wig,ang*0.3,0,0,(t>0.2&&t<0.6)?0.1:eyeOpen,(t>0.3&&t<0.5)?0.3:0);
    ctx.restore();
  }

  function drawSleeping(t) {
    var br = Math.sin(t*Math.PI*8)*2;
    drawTail(55,138,0,true);
    ell(90,132,34,20+br*0.3,G); ell(90,128,20,14+br*0.2,W);
    ell(72,144,7,5,W);
    ctx.save(); ctx.translate(90,105); ctx.rotate(-0.1);
    cir(0,0,28,G);
    ctx.beginPath(); ctx.moveTo(0,-16);
    ctx.bezierCurveTo(-15,-6,-14,10,0,18); ctx.bezierCurveTo(14,10,15,-6,0,-16);
    ctx.fillStyle=W; ctx.fill();
    drawEar(-18,-23,-0.3); drawEar(18,-23,0.3);
    ctx.strokeStyle=PUP; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(-16,-2); ctx.quadraticCurveTo(-10,2,-5,-2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5,-2); ctx.quadraticCurveTo(10,2,16,-2); ctx.stroke();
    cir(-16,6,5,BLU); cir(16,6,5,BLU);
    ctx.beginPath(); ctx.moveTo(0,5); ctx.lineTo(-3,8); ctx.lineTo(3,8); ctx.closePath();
    ctx.fillStyle=PNK; ctx.fill();
    ctx.restore();
    if (Math.random()<0.02) zzzs.push({x:125,y:85,o:1,s:10+Math.random()*4});
    ctx.font = '600 italic 13px "Cormorant Garamond",serif';
    zzzs = zzzs.filter(function(z) {
      z.y-=0.4; z.x+=0.2; z.o-=0.008;
      if (z.o<=0) return false;
      ctx.globalAlpha=z.o; ctx.fillStyle=GL; ctx.fillText('z',z.x,z.y);
      ctx.globalAlpha=1; return true;
    });
  }

  function drawWalking(t) {
    var lk = getLook(), lp = t*Math.PI*12;
    posX += walkDir*0.8;
    if (posX<100) walkDir=1;
    if (posX>window.innerWidth-100) walkDir=-1;
    setPos();
    var flip = walkDir < 0;
    ctx.save();
    if (flip) { ctx.translate(180,0); ctx.scale(-1,1); }
    tailPh += 0.06;
    drawTail(120,125,tailPh,false);
    ell(90,118,28,22,G,-0.05); ell(90,114,17,15,W,-0.05);
    var ll=Math.sin(lp)*6, lr=Math.sin(lp+Math.PI)*6;
    drawPaw(68,140+ll,true); drawPaw(108,140+lr,false);
    var bob = Math.sin(lp*0.5)*2;
    drawHead(90,70+bob,0,flip?-lk.x:lk.x,lk.y,eyeOpen,0);
    ctx.restore();
  }

  function drawYawning(t) {
    var lk = getLook(); tailPh += 0.02;
    var mo = t<0.2?t/0.2:t<0.6?1:1-(t-0.6)/0.4; mo = smooth(mo);
    drawTail(120,130,tailPh,false);
    drawBody(90,120,30,24);
    drawPaw(68,143,true); drawPaw(112,143,false);
    drawHead(90,72,0,lk.x,lk.y,mo>0.5?0.15:eyeOpen,mo,mo>0.3);
  }

  function drawPetReaction() {
    var lk = getLook(); tailPh += 0.08;
    var w = Math.sin(performance.now()/80)*2;
    drawTail(120,130,tailPh,false);
    drawBody(90,120,30,24);
    drawPaw(68+w,143,true); drawPaw(112-w,143,false);
    drawHead(90,72,0,lk.x,lk.y,0.05,0);
  }

  function drawHeart(x,y,sz,a) {
    ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=HRT;
    ctx.beginPath(); ctx.moveTo(x,y);
    ctx.bezierCurveTo(x-sz/2,y-sz,x-sz,y-sz/3,x,y+sz*0.6);
    ctx.bezierCurveTo(x+sz,y-sz/3,x+sz/2,y-sz,x,y);
    ctx.fill(); ctx.restore();
  }
  function updateHearts() {
    hearts = hearts.filter(function(h) {
      h.y-=1.2; h.x+=Math.sin(h.ph)*0.5; h.ph+=0.08; h.o-=0.015;
      if(h.o<=0)return false; drawHeart(h.x,h.y,h.sz,h.o); return true;
    });
  }
  function spawnHeart() {
    hearts.push({x:70+Math.random()*40,y:45+Math.random()*20,sz:6+Math.random()*6,o:1,ph:Math.random()*6.28});
  }

  var IDLES = ['sit','sit','sit','stretch','lick','roll','yawn','sleep','walk'];
  var DURS = {sit:function(){return 3000+Math.random()*4000},stretch:function(){return 3500},
    lick:function(){return 4000},roll:function(){return 3500},yawn:function(){return 3000},
    sleep:function(){return 8000+Math.random()*5000},walk:function(){return 4000+Math.random()*3000}};
  function nextState() {
    if(petT>0)return;
    var s = IDLES[Math.floor(Math.random()*IDLES.length)];
    state=s; stateT=0; stateDur=DURS[s]();
  }

  function update(dt) {
    blinkT+=dt;
    if(blinkT>nextBlink){blinkT=0;nextBlink=2000+Math.random()*4000;eyeOpen=0;setTimeout(function(){eyeOpen=1;},150);}
    if(petT>0){petT-=dt;if(petT<=0){petT=0;state='sit';stateT=0;stateDur=DURS.sit();}}
    stateT+=dt/stateDur;
    if(stateT>=1&&petT<=0) nextState();
  }

  function draw() {
    ctx.clearRect(0,0,180,180);
    ctx.beginPath(); ctx.ellipse(90,158,35,6,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.06)'; ctx.fill();
    var t = Math.min(stateT,1);
    if(petT>0) drawPetReaction();
    else switch(state){
      case 'sit':drawSitting(t);break;case 'stretch':drawStretching(t);break;
      case 'lick':drawLicking(t);break;case 'roll':drawRolling(t);break;
      case 'sleep':drawSleeping(t);break;case 'walk':drawWalking(t);break;
      case 'yawn':drawYawning(t);break;default:drawSitting(t);
    }
    updateHearts();
  }

  function loop(now) {
    var dt = Math.min(now-lastF,100); lastF=now;
    update(dt); draw(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  document.addEventListener('mousemove',function(e){
    mx=e.clientX; my=e.clientY;
    if(isDrag){dragMoved=true;posX=e.clientX-dragOX;posY=e.clientY-dragOY;setPos();}
  });
  cvs.addEventListener('mousedown',function(e){
    isDrag=true;dragMoved=false;dragOX=e.clientX-posX;dragOY=e.clientY-posY;
    cvs.style.cursor='grabbing';e.preventDefault();
  });
  document.addEventListener('mouseup',function(){
    if(isDrag){
      isDrag=false;cvs.style.cursor='grab';
      if(!dragMoved){petT=2000;state='pet';for(var i=0;i<5;i++)setTimeout(spawnHeart,i*200);}
    }
  });
  cvs.addEventListener('touchstart',function(e){
    var t=e.touches[0];isDrag=true;dragMoved=false;
    dragOX=t.clientX-posX;dragOY=t.clientY-posY;
    mx=t.clientX;my=t.clientY;
    petT=2000;state='pet';for(var i=0;i<5;i++)setTimeout(spawnHeart,i*200);
    e.preventDefault();
  },{passive:false});
  cvs.addEventListener('touchmove',function(e){
    var t=e.touches[0];mx=t.clientX;my=t.clientY;
    if(isDrag){dragMoved=true;posX=t.clientX-dragOX;posY=t.clientY-dragOY;setPos();}
    e.preventDefault();
  },{passive:false});
  cvs.addEventListener('touchend',function(){isDrag=false;});

  window.addEventListener('resize',function(){
    if(posX>window.innerWidth-50)posX=window.innerWidth-120;
    if(posY>window.innerHeight-50)posY=window.innerHeight-90;
    setPos();
  });
})();
