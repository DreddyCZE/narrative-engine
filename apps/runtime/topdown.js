(() => {
  const TILE = 32;
  const COLS = 30;
  const ROWS = 20;
  const COLORS = { floor: 0x172733, corridor: 0x263b47, wall: 0x536a77, wallEdge: 0x263b46, room: 0x1c303b, locked: 0x542b31, cyan: 0x55d7e8, amber: 0xf0bd62 };
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(1)); // 1 = wall, 0 = walkable
  const rooms = [
    { id: "chamber", x: 2, y: 2, w: 7, h: 6, name: "Komora 7", description: "Probudil ses v nouzové ubytovací komoře. Terminál je bez spojení; dveře vedou do hlavní chodby.", color: 0x1b3039 },
    { id: "blockC", x: 11, y: 2, w: 6, h: 6, name: "Blok C", description: "Obytný blok je opuštěný. Na podlaze leží čerstvé stopy, ale nikdo neodpovídá.", color: 0x1b3039 },
    { id: "section99", x: 20, y: 2, w: 7, h: 6, name: "Sekce 99-ALFA", description: "Za pancéřovými dveřmi je ticho. Přístupový panel hlásí bezpečnostní uzávěru.", color: 0x281d25 },
    { id: "workshop", x: 2, y: 12, w: 7, h: 5, name: "Dílna a sklad", description: "Police jsou téměř prázdné. Servisní robot zanechal na konzoli chybový kód.", color: 0x1b3039 },
    { id: "utility", x: 11, y: 12, w: 6, h: 5, name: "Technická komora", description: "Rozvodna napájí osvětlení chodby. Některé okruhy jsou přetížené.", color: 0x1b3039 },
    { id: "reactor", x: 20, y: 12, w: 7, h: 5, name: "Servisní uzel", description: "Za mříží bliká diagnostický panel. K technickému patru bude potřeba výtah.", color: 0x1b3039 }
  ];
  const doors = [
    { id: "door-chamber", x: 5, y: 8, room: "chamber", target: "corridor", label: "Dveře Komory 7", locked: false },
    { id: "door-block-c", x: 13, y: 8, room: "blockC", target: "corridor", label: "Vstup do Bloku C", locked: false },
    { id: "door-99", x: 23, y: 8, room: "section99", target: "corridor", label: "Sekce 99-ALFA", locked: true },
    { id: "door-workshop", x: 5, y: 11, room: "workshop", target: "corridor", label: "Dílna a sklad", locked: false },
    { id: "door-utility", x: 13, y: 11, room: "utility", target: "corridor", label: "Technická komora", locked: false },
    { id: "door-reactor", x: 23, y: 11, room: "reactor", target: "corridor", label: "Servisní uzel", locked: false }
  ];
  function carveRoom(r) { for (let y=r.y; y<r.y+r.h; y++) for (let x=r.x; x<r.x+r.w; x++) grid[y][x]=0; }
  rooms.forEach(carveRoom);
  // Main horizontal corridor and central vertical connections.
  for (let y=9; y<=10; y++) for (let x=1; x<COLS-1; x++) grid[y][x]=0;
  for (let x=1; x<COLS-1; x++) { grid[8][x]=1; grid[11][x]=1; }
  doors.forEach(d => { grid[d.y][d.x]=0; });
  // Door openings lead into the corridor.
  for (const x of [5,13,23]) { grid[8][x]=0; grid[11][x]=0; }
  // Small gaps from rooms into their door tiles.
  const config = { type: Phaser.AUTO, parent: "game", width: COLS*TILE, height: ROWS*TILE, backgroundColor: "#09121a", pixelArt: true, physics: { default: "arcade", arcade: { debug: false } }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: COLS*TILE, height: ROWS*TILE }, scene: { preload, create, update } };
  let game;
  let sceneRef;
  let player;
  let keys;
  let nearby;
  let roomText;
  let doorObjects = [];
  let wallGroup;
  let messageText;
  let currentRoom = "chamber";
  let visited = new Set();
  let objectiveDone = false;
  function preload() {}
  function create() {
    sceneRef = this;
    this.cameras.main.setBackgroundColor("#09121a");
    const graphics = this.add.graphics();
    // Grid floor tiles and metallic wall tiles.
    for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
      const px=x*TILE, py=y*TILE;
      if (grid[y][x]===0) {
        const inRoom=rooms.find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
        graphics.fillStyle(inRoom ? inRoom.color : COLORS.corridor, 1);
        graphics.fillRect(px,py,TILE,TILE);
        graphics.lineStyle(1,0x304956,0.55); graphics.strokeRect(px+0.5,py+0.5,TILE-1,TILE-1);
      } else {
        graphics.fillStyle(COLORS.wall,1); graphics.fillRect(px,py,TILE,TILE);
        graphics.fillStyle(COLORS.wallEdge,1); graphics.fillRect(px+2,py+2,TILE-4,TILE-4);
        graphics.lineStyle(1,0x738995,0.55); graphics.strokeRect(px+4,py+4,TILE-8,TILE-8);
      }
    }
    // Room furniture / terminals.
    rooms.forEach(r=>{
      const cx=(r.x+r.w/2)*TILE, cy=(r.y+r.h/2)*TILE;
      this.add.text(cx, r.y*TILE+10, r.name.toUpperCase(), {fontFamily:"monospace",fontSize:"10px",color:"#8daab8",align:"center"}).setOrigin(.5,0);
      if(r.id==="chamber"){
        this.add.rectangle((r.x+2)*TILE,(r.y+2.5)*TILE,76,34,0x53616b).setStrokeStyle(2,0x7f939d);
        this.add.rectangle((r.x+2)*TILE,(r.y+2.5)*TILE,64,23,0x273943);
        this.add.rectangle((r.x+5)*TILE,(r.y+4)*TILE,25,20,0x263d48).setStrokeStyle(2,COLORS.cyan);
      } else if(r.id==="section99") {
        this.add.rectangle((r.x+r.w/2)*TILE,(r.y+3)*TILE,38,25,0x6b3237).setStrokeStyle(2,0xc65b61);
        this.add.text((r.x+r.w/2)*TILE,(r.y+3)*TILE,"LOCK",{fontFamily:"monospace",fontSize:"9px",color:"#ffd0c9"}).setOrigin(.5);
      } else {
        this.add.rectangle((r.x+r.w/2)*TILE,(r.y+3)*TILE,44,25,0x263d48).setStrokeStyle(2,0x4c7181);
      }
    });
    doorObjects = doors.map(d=>{
      const color=d.locked?0xd35d63:0x58d9e7;
      const rect=this.add.rectangle((d.x+.5)*TILE,(d.y+.5)*TILE,TILE-3,7,color).setStrokeStyle(1,0x071018);
      rect.setData("door",d);
      this.add.circle((d.x+.5)*TILE,(d.y+.5)*TILE,3,d.locked?0xff9b8e:0x9bffff);
      return rect;
    });
    // Decorative corridor lighting.
    for(let x=2;x<COLS-2;x+=4) this.add.rectangle((x+.5)*TILE,9.5*TILE,2,22,0x55d7e8,.7);
    wallGroup=this.physics.add.staticGroup();
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(grid[y][x]===1) {
      const wall=this.add.rectangle((x+.5)*TILE,(y+.5)*TILE,TILE,TILE,0x000000,0);
      this.physics.add.existing(wall,true); wallGroup.add(wall);
    }
    player=this.add.container(5.5*TILE,4.5*TILE);
    const shadow=this.add.ellipse(0,9,22,10,0x000000,.4);
    const body=this.add.rectangle(0,0,16,20,0xf0bd62).setStrokeStyle(2,0xffe0a1);
    const visor=this.add.rectangle(0,-4,10,5,0x142e3a);
    player.add([shadow,body,visor]);
    this.physics.add.existing(player);
    player.body.setSize(16,18); player.body.setOffset(-8,-8); player.body.setCollideWorldBounds(true);
    this.physics.add.collider(player,wallGroup);
    this.physics.world.setBounds(0,0,COLS*TILE,ROWS*TILE);
    this.cameras.main.setBounds(0,0,COLS*TILE,ROWS*TILE);
    this.cameras.main.startFollow(player,false,.12,.12);
    this.cameras.main.setZoom(1);
    keys=this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E");
    messageText=this.add.text(12,12,"", {fontFamily:"monospace",fontSize:"12px",color:"#ffffff",backgroundColor:"#10222ddd",padding:{x:8,y:6}}).setScrollFactor(0).setDepth(100);
    roomText=this.add.text(0,0,"", {fontFamily:"monospace",fontSize:"10px",color:"#9feef5"}).setDepth(50);
    this.physics.world.on("worldbounds",()=>{});
    this.add.text(15*TILE,9.5*TILE,"HLAVNÍ CHODBA",{fontFamily:"monospace",fontSize:"11px",color:"#8eb4c4"}).setOrigin(.5).setAlpha(.7);
    this.input.keyboard.on("keydown-E",interact);
    visited.add("chamber"); updatePanel(rooms[0]);
    this.time.addEvent({delay:250,loop:true,callback:()=>refreshNearby()});
  }
  function update() {
    if(!player||!player.body) return;
    const speed=145, body=player.body;
    let vx=0,vy=0;
    if(keys.A.isDown||keys.LEFT.isDown) vx=-speed;
    else if(keys.D.isDown||keys.RIGHT.isDown) vx=speed;
    if(keys.W.isDown||keys.UP.isDown) vy=-speed;
    else if(keys.S.isDown||keys.DOWN.isDown) vy=speed;
    if(vx&&vy){vx*=.707;vy*=.707;}
    body.setVelocity(vx,vy);
    player.setDepth(player.y);
    refreshNearby();
  }
  function refreshNearby(){
    if(!player) return;
    nearby=doors.map(d=>({d,dist:Phaser.Math.Distance.Between(player.x,player.y,(d.x+.5)*TILE,(d.y+.5)*TILE)})).sort((a,b)=>a.dist-b.dist)[0];
    const d=nearby&&nearby.dist<52?nearby.d:null;
    if(d) messageText.setText(d.locked?"[E] SEKCE 99-ALFA — ZAMČENO":"[E] "+d.label+" — otevřít");
    else messageText.setText("WASD pohyb  ·  E interakce");
    const room=rooms.find(r=>player.x>=r.x*TILE&&player.x<(r.x+r.w)*TILE&&player.y>=r.y*TILE&&player.y<(r.y+r.h)*TILE);
    if(room&&room.id!==currentRoom){currentRoom=room.id;visited.add(room.id);updatePanel(room);if(room.id==="blockC")addLog("V Bloku C jsou stopy po nouzové evakuaci.");}
    else if(!room&&currentRoom!=="corridor"&&player.y>=8*TILE&&player.y<12*TILE){currentRoom="corridor";updatePanel({name:"Hlavní chodba",description:"Hlavní spojovací koridor paluby P0. Dveře Sekce 99-ALFA jsou uzamčené bezpečnostním protokolem."});}
    if(visited.has("blockC")&&!objectiveDone){objectiveDone=true;document.querySelector("#objective").textContent="Prozkoumej Blok C. Sekce 99-ALFA zůstává zamčená.";addLog("Nový cíl: zjistit, co se stalo v Bloku C.");}
  }
  function interact(){
    if(!nearby||nearby.dist>=52){addLog("V dosahu není žádný panel ani dveře.");return;}
    const d=nearby.d;
    if(d.locked){addLog("PŘÍSTUP ZAMÍTNUT — vyžadováno oprávnění velitele.");showMessage("PŘÍSTUP ZAMÍTNUT");return;}
    const r=rooms.find(x=>x.id===d.room);
    if(r){
      const cx=(r.x+r.w/2)*TILE, cy=(r.y+r.h/2)*TILE;
      const toRoom=Phaser.Math.Distance.Between(player.x,player.y,cx,cy)>0;
      addLog("Dveře aktivovány: "+d.label+".");
      // Doors are openings in the wall; walking through them performs the movement.
      showMessage("DVEŘE ODEMČENY");
    }
  }
  function showMessage(text){messageText.setText(text);sceneRef.time.delayedCall(1400,()=>refreshNearby());}
  function updatePanel(room){document.querySelector("#room-name").textContent=room.name;document.querySelector("#room-description").textContent=room.description;}
  function addLog(line){const list=document.querySelector("#log");const li=document.createElement("li");li.textContent=line;list.prepend(li);while(list.children.length>5)list.lastElementChild.remove();}
  function boot(){game=new Phaser.Game(config);}
  document.querySelector("#reset").addEventListener("click",()=>{if(game)game.destroy(true);currentRoom="chamber";visited=new Set();objectiveDone=false;document.querySelector("#objective").textContent="Dostaň se z Komory 7 do hlavní chodby.";document.querySelector("#log").replaceChildren();boot();});
  boot();
})();