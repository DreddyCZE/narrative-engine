(() => {
  "use strict";
  const TILE=32, COLS=30, ROWS=20, SPEED=125;
  const C={wall:0x425a68,edge:0x1b2c37,corridor:0x263d49,cyan:0x55d7e8,amber:0xf0bd62,red:0xd65f68};
  const grid=Array.from({length:ROWS},()=>Array(COLS).fill(1));
  const rooms=[
    {id:"chamber",x:2,y:2,w:7,h:6,name:"Komora 7",desc:"Nouzová obytná komora. Paměť je roztříštěná, komunikační terminál hlásí výpadek. Na podlaze bliká malý servisní modul.",color:0x1b3039},
    {id:"blockC",x:11,y:2,w:6,h:6,name:"Obytný blok C",desc:"Několik lůžek je převrácených. Na stěně je zaschlá stopa a nouzový záznamník stále napájí jedinou diodu.",color:0x1b3039},
    {id:"section99",x:20,y:2,w:7,h:6,name:"Sekce 99-ALFA",desc:"Pancéřové dveře jsou uzamčeny protokolem velitele. Panel požaduje bezpečnostní klíč a obnovení napájení.",color:0x2c2028},
    {id:"workshop",x:2,y:12,w:7,h:5,name:"Dílna a sklad",desc:"Prázdné regály, servisní vozík a rozebraný údržbový robot. Některé součástky by se ještě mohly hodit.",color:0x1b3039},
    {id:"utility",x:11,y:12,w:6,h:5,name:"Technická komora",desc:"Rozvodna napájí palubu P0. Jeden jistič je shozený; vedle něj je nouzový ovládací panel.",color:0x1b3039},
    {id:"reactor",x:20,y:12,w:7,h:5,name:"Servisní uzel",desc:"Za mříží vede servisní trasa k výtahu. Terminál hlásí, že přístup na technické patro čeká na autorizaci.",color:0x1b3039}
  ];
  for(const r of rooms) for(let y=r.y;y<r.y+r.h;y++) for(let x=r.x;x<r.x+r.w;x++) grid[y][x]=0;
  for(let y=9;y<=10;y++) for(let x=1;x<COLS-1;x++) grid[y][x]=0;
  const doors=[
    {id:"d1",x:5,y:8,room:"chamber",name:"Dveře Komory 7"},
    {id:"d2",x:13,y:8,room:"blockC",name:"Vstup do Bloku C"},
    {id:"d3",x:23,y:8,room:"section99",name:"Sekce 99-ALFA",locked:true},
    {id:"d4",x:5,y:11,room:"workshop",name:"Dílna a sklad"},
    {id:"d5",x:13,y:11,room:"utility",name:"Technická komora"},
    {id:"d6",x:23,y:11,room:"reactor",name:"Servisní uzel"}
  ];
  for(let x=1;x<COLS-1;x++){grid[8][x]=1;grid[11][x]=1;}
  for(const d of doors)grid[d.y][d.x]=0;
  const objects=[
    {id:"pod",x:4,y:5,title:"Nouzový modul",text:"V modulu najdeš servisní kartu s nečitelným označením. Karta je uložena do inventáře.",once:true,item:"Servisní karta"},
    {id:"terminal",x:7,y:5,title:"Osobní terminál",text:"POSLEDNÍ ZÁZNAM: „...světla zhasla v 03:17. Velitel nařídil uzavřít 99-ALFA. Nikdo nesmí dolů.“"},
    {id:"recorder",x:14,y:5,title:"Nouzový záznamník",text:"Záznam: „Evakuace Bloku C selhala. Bezpečnostní klíč byl předán technikovi. Hledejte v rozvodně.“",once:true,item:"Fragment záznamu"},
    {id:"breaker",x:14,y:14,title:"Nouzový jistič",text:"Jistič cvakne a nouzové okruhy se rozsvítí. Sekce 99-ALFA však stále vyžaduje oprávnění velitele.",once:true,item:"Napájení P0 obnoveno"},
    {id:"robot",x:5,y:14,title:"Servisní robot R-04",text:"Robot se probere: „...KLÍČ... POD SKŘÍNÍ...“ Kovový klíč je zachycen pod servisním vozíkem.",once:true,item:"Bezpečnostní klíč"},
    {id:"lift",x:24,y:14,title:"Výtah na P1",text:"Výtah je funkční, ale ovládací panel vyžaduje bezpečnostní kartu a obnovené napájení."}
  ];
  const config={type:Phaser.AUTO,parent:"game",width:COLS*TILE,height:ROWS*TILE,backgroundColor:"#08121a",pixelArt:true,physics:{default:"arcade",arcade:{debug:false}},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:COLS*TILE,height:ROWS*TILE},scene:{create,update}};
  let game,scene,player,keys,wallGroup,route=[],moveTarget=null,nearby=null,visited=new Set(),inventory=new Set(),used=new Set(),power=false,quest=0,toastTimer;
  const tileOf=(x,y)=>({x:Math.floor(x/TILE),y:Math.floor(y/TILE)});
  function create(){
    scene=this;this.cameras.main.setBackgroundColor("#08121a");
    const g=this.add.graphics();
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const px=x*TILE,py=y*TILE;
      if(!grid[y][x]){const r=rooms.find(a=>x>=a.x&&x<a.x+a.w&&y>=a.y&&y<a.y+a.h);g.fillStyle(r?r.color:C.corridor,1);g.fillRect(px,py,TILE,TILE);g.lineStyle(1,0x304957,.55);g.strokeRect(px+.5,py+.5,TILE-1,TILE-1);}
      else{g.fillStyle(C.wall,1);g.fillRect(px,py,TILE,TILE);g.fillStyle(C.edge,1);g.fillRect(px+3,py+3,TILE-6,TILE-6);g.lineStyle(1,0x657e8b,.35);g.strokeRect(px+5,py+5,TILE-10,TILE-10);}
    }
    rooms.forEach(r=>{
      this.add.text((r.x+r.w/2)*TILE,r.y*TILE+8,r.name.toUpperCase(),{fontFamily:"monospace",fontSize:"10px",color:"#9ab6c4",align:"center"}).setOrigin(.5,0);
      if(r.id==="chamber"){this.add.rectangle((r.x+2)*TILE,(r.y+2.4)*TILE,72,30,0x53616b).setStrokeStyle(2,0x7f939d);this.add.rectangle((r.x+2)*TILE,(r.y+2.4)*TILE,60,20,0x273943);this.add.rectangle((r.x+5)*TILE,(r.y+4)*TILE,24,18,0x263d48).setStrokeStyle(2,C.cyan);}
      else if(r.id==="section99"){this.add.rectangle((r.x+r.w/2)*TILE,(r.y+3)*TILE,46,26,0x6b3237).setStrokeStyle(2,C.red);this.add.text((r.x+r.w/2)*TILE,(r.y+3)*TILE,"LOCK",{fontFamily:"monospace",fontSize:"9px",color:"#ffd0c9"}).setOrigin(.5);}
      else {for(let i=0;i<2;i++)this.add.rectangle((r.x+2+i*2)*TILE,(r.y+3)*TILE,42,20,r.id==="utility"?0x594b32:0x263d48).setStrokeStyle(1,0x4c7181);}
    });
    for(let x=2;x<COLS-2;x+=4)this.add.rectangle((x+.5)*TILE,9.5*TILE,2,22,C.cyan,.7);
    this.add.text(15*TILE,9.5*TILE,"HLAVNÍ CHODBA",{fontFamily:"monospace",fontSize:"11px",color:"#8eb4c4"}).setOrigin(.5).setAlpha(.7);
    doors.forEach(d=>{this.add.rectangle((d.x+.5)*TILE,(d.y+.5)*TILE,28,7,d.locked?C.red:C.cyan).setStrokeStyle(1,0x071018);this.add.circle((d.x+.5)*TILE,(d.y+.5)*TILE,3,d.locked?0xff9b8e:0x9bffff);});
    objects.forEach(o=>{const color=o.id==="breaker"?0xf0bd62:o.id==="robot"?0x9acb8e:0x55d7e8;this.add.rectangle((o.x+.5)*TILE,(o.y+.5)*TILE,19,19,0x10212c).setStrokeStyle(2,color);this.add.circle((o.x+.5)*TILE,(o.y+.5)*TILE,4,color);this.add.text((o.x+.5)*TILE,(o.y+.5)*TILE-17,"◆",{fontSize:"10px",color:"#c7faff"}).setOrigin(.5);});
    wallGroup=this.physics.add.staticGroup();
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x]){const w=this.add.rectangle((x+.5)*TILE,(y+.5)*TILE,TILE,TILE,0,0);this.physics.add.existing(w,true);wallGroup.add(w);}
    player=this.add.container(5.5*TILE,4.5*TILE);
    player.add([this.add.ellipse(0,9,22,10,0x000000,.4),this.add.rectangle(0,0,16,20,C.amber).setStrokeStyle(2,0xffe0a1),this.add.rectangle(0,-4,10,5,0x142e3a)]);
    this.physics.add.existing(player);player.body.setSize(16,18);player.body.setOffset(-8,-8);player.body.setCollideWorldBounds(true);this.physics.add.collider(player,wallGroup);
    this.physics.world.setBounds(0,0,COLS*TILE,ROWS*TILE);this.cameras.main.setBounds(0,0,COLS*TILE,ROWS*TILE);this.cameras.main.startFollow(player,false,.12,.12);
    keys=this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE");
    this.input.on("pointerdown",p=>{const wp=this.cameras.main.getWorldPoint(p.x,p.y);handleClick(Math.floor(wp.x/TILE),Math.floor(wp.y/TILE));});
    this.input.keyboard.on("keydown-E",interact);this.input.keyboard.on("keydown-SPACE",interact);
    visited.add("chamber");setRoom(rooms[0]);log("Nouzové napájení aktivní.");log("Komunikační síť nedostupná.");syncUI();notify("Klikni na podlahu pro pohyb. Klikni na objekt poblíž pro interakci.");
  }
  function walkable(x,y){return x>=0&&x<COLS&&y>=0&&y<ROWS&&grid[y][x]===0;}
  function findPath(sx,sy,tx,ty){
    if(!walkable(tx,ty))return [];
    const q=[[sx,sy]],prev=new Map([[sx+","+sy,null]]),dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    while(q.length){const [x,y]=q.shift();if(x===tx&&y===ty)break;for(const [dx,dy]of dirs){const nx=x+dx,ny=y+dy,k=nx+","+ny;if(walkable(nx,ny)&&!prev.has(k)){prev.set(k,[x,y]);q.push([nx,ny]);}}}
    const end=tx+","+ty;if(!prev.has(end))return [];const path=[];let cur=[tx,ty];while(cur){path.push(cur);cur=prev.get(cur[0]+","+cur[1]);}return path.reverse().slice(1);
  }
  function handleClick(tx,ty){
    const target=[...objects.map(o=>({...o,type:"object"})),...doors.map(d=>({...d,type:"door"}))].sort((a,b)=>Math.abs(a.x-tx)+Math.abs(a.y-ty)-Math.abs(b.x-tx)-Math.abs(b.y-ty))[0];
    if(target&&Math.abs(target.x-tx)+Math.abs(target.y-ty)<=1){moveToAdjacent(target);return;}
    if(walkable(tx,ty)){const p=tileOf(player.x,player.y);route=findPath(p.x,p.y,tx,ty);moveTarget=null;if(!route.length)notify("Tudy se nedá projít.");else notify("Přesouvám se…");}
    else notify("Tady je stěna. Klikni na průchozí podlahu.");
  }
  function moveToAdjacent(o){const p=tileOf(player.x,player.y);const opts=[[o.x,o.y-1],[o.x-1,o.y],[o.x+1,o.y],[o.x,o.y+1]].filter(([x,y])=>walkable(x,y)).map(([x,y])=>({x,y,path:findPath(p.x,p.y,x,y)})).filter(a=>a.path.length||p.x===a.x&&p.y===a.y).sort((a,b)=>a.path.length-b.path.length);if(opts.length){route=opts[0].path;moveTarget={type:o.type,id:o.id};if(!route.length)interactTarget(moveTarget);else notify("Přibližuji se k "+(o.name||o.title)+"…");}}
  function update(_,delta){
    if(!player)return;let vx=0,vy=0;const speed=SPEED;
    if(keys.A.isDown||keys.LEFT.isDown)vx=-speed;else if(keys.D.isDown||keys.RIGHT.isDown)vx=speed;
    if(keys.W.isDown||keys.UP.isDown)vy=-speed;else if(keys.S.isDown||keys.DOWN.isDown)vy=speed;
    if(vx||vy){route=[];moveTarget=null;if(vx&&vy){vx*=.707;vy*=.707;}player.body.setVelocity(vx,vy);}
    else if(route.length){const [tx,ty]=route[0],cx=(tx+.5)*TILE,cy=(ty+.5)*TILE,dx=cx-player.x,dy=cy-player.y,dist=Math.hypot(dx,dy);if(dist<5){player.setPosition(cx,cy);route.shift();if(!route.length&&moveTarget){const t=moveTarget;moveTarget=null;interactTarget(t);}}else player.body.setVelocity(dx/dist*speed,dy/dist*speed);}
    else player.body.setVelocity(0,0);
    player.setDepth(player.y);refresh();
  }
  function refresh(){
    const p=tileOf(player.x,player.y);
    const room=rooms.find(r=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h);
    if(room&&!visited.has(room.id)){visited.add(room.id);setRoom(room);log("Prozkoumána oblast: "+room.name+".");if(room.id==="blockC"){quest=Math.max(quest,1);log("Našel jsi záznam o klíči v technické komoře.");}}
    else if(room&&document.querySelector("#room-name").textContent!==room.name)setRoom(room);
    else if(!room&&p.y>=8&&p.y<=11&&document.querySelector("#room-name").textContent!=="Hlavní chodba")setRoom({name:"Hlavní chodba",desc:"Paluba P0 — hlavní spojovací koridor. Nouzová světla blikají v nepravidelných intervalech."});
    const candidates=[...objects.map(o=>({...o,type:"object"})),...doors.map(d=>({...d,type:"door"}))].map(o=>({...o,dist:Math.hypot(player.x-(o.x+.5)*TILE,player.y-(o.y+.5)*TILE)})).sort((a,b)=>a.dist-b.dist);
    nearby=candidates[0]&&candidates[0].dist<52?candidates[0]:null;
    document.querySelector("#interact-hint").textContent=nearby?(nearby.type==="door"?(nearby.locked?"Sekce 99-ALFA — zamčeno":"Dveře: "+nearby.name):"Objekt: "+nearby.title):"Klikni na podlahu pro pohyb";
    syncUI();
  }
  function interact(){if(nearby)interactTarget({type:nearby.type,id:nearby.id});else notify("Přijdi blíž k objektu nebo dveřím.");}
  function interactTarget(t){
    if(t.type==="door"){const d=doors.find(a=>a.id===t.id);if(d.locked){if(inventory.has("Bezpečnostní klíč")&&power){d.locked=false;log("Bezpečnostní klíč přijat. Zámek Sekce 99-ALFA se uvolnil.");notify("SEKCE 99-ALFA ODEMČENA");quest=3;}else{log("PŘÍSTUP ZAMÍTNUT — chybí "+[!inventory.has("Bezpečnostní klíč")?"bezpečnostní klíč":"",!power?"napájení P0":""].filter(Boolean).join(" a ")+".");notify("PŘÍSTUP ZAMÍTNUT");}return;}log(d.name+": dveře se otevřely.");return;}
    const o=objects.find(a=>a.id===t.id);if(!o)return;
    if(o.id==="lift"&&(!power||!inventory.has("Bezpečnostní klíč"))){notify("Výtah vyžaduje napájení a bezpečnostní klíč.");log("Výtah zůstává uzamčen.");return;}
    if(o.once&&used.has(o.id)){notify(o.title+" — nic dalšího.");return;}
    if(o.once)used.add(o.id);
    if(o.id==="breaker"){power=true;quest=Math.max(quest,2);document.querySelector("#status").textContent="NAPÁJENÍ P0 OBNOVENO";document.querySelector("#status").classList.add("online");}
    if(o.item&&o.id==="robot"){inventory.add(o.item);}
    if(o.id==="pod")inventory.add("Servisní karta");
    if(o.id==="recorder")inventory.add("Fragment záznamu");
    if(o.id==="lift"){notify("Výtah aktivován — paluba P1 bude další oblast.");log("Nový cíl: pokračovat na technické patro P1.");return;}
    if(o.id==="terminal"||o.id==="recorder")showData(o.title,o.text);
    else {log(o.text);notify(o.title+": "+o.text);}
    if(o.id==="robot"){inventory.add("Bezpečnostní klíč");log("Získán předmět: Bezpečnostní klíč.");}
    syncUI();
  }
  function setRoom(r){document.querySelector("#room-name").textContent=r.name;document.querySelector("#room-description").textContent=r.desc;}
  function log(s){const li=document.createElement("li");li.textContent=s;document.querySelector("#log").prepend(li);while(document.querySelector("#log").children.length>7)document.querySelector("#log").lastElementChild.remove();}
  function notify(s){const el=document.querySelector("#toast");el.textContent=s;el.classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("visible"),2300);}
  function showData(title,body){document.querySelector("#modal-title").textContent=title;document.querySelector("#modal-text").textContent=body;document.querySelector("#modal").hidden=false;}
  function syncUI(){const list=document.querySelector("#inventory");list.replaceChildren();if(!inventory.size){const li=document.createElement("li");li.textContent="Prázdný";list.append(li);}else for(const item of inventory){const li=document.createElement("li");li.textContent="▣ "+item;list.append(li);}const tasks=["Opusť Komoru 7 a prozkoumej Blok C","Najdi bezpečnostní klíč v servisní dílně","Obnov napájení v technické komoře","Odemkni Sekci 99-ALFA"];document.querySelector("#objective").textContent=tasks[Math.min(quest,3)];document.querySelector("#progress").textContent=visited.size+" / "+rooms.length+" oblastí";}
  function boot(){game=new Phaser.Game(config);}
  document.querySelector("#reset").addEventListener("click",()=>{if(game)game.destroy(true);route=[];moveTarget=null;visited=new Set();inventory=new Set();used=new Set();power=false;quest=0;document.querySelector("#log").replaceChildren();document.querySelector("#status").textContent="SYSTÉMY ČÁSTEČNĚ FUNKČNÍ";document.querySelector("#status").classList.remove("online");boot();});
  document.querySelector("#modal-close").addEventListener("click",()=>document.querySelector("#modal").hidden=true);
  document.querySelectorAll("[data-move]").forEach(b=>b.addEventListener("click",()=>{const d=b.dataset.move;const p=tileOf(player.x,player.y);const step={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[d];const tx=p.x+step[0],ty=p.y+step[1];route=findPath(p.x,p.y,tx,ty);moveTarget=null;if(!route.length)notify("Tímto směrem je překážka.");}));
  boot();
})();