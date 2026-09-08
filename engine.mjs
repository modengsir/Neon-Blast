export const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
export class Game {
 constructor(){this.reset()}
 reset(){this.grid=Array.from({length:11},(_,z)=>Array.from({length:11},(_,x)=>x===0||z===0||x===10||z===10||(x%2===0&&z%2===0)?1:0));
 for(const [x,z] of [[3,1],[5,1],[7,1],[3,2],[1,3],[3,3],[4,3],[6,3],[8,3],[9,3],[1,5],[2,5],[4,5],[6,5],[8,5],[9,5],[3,6],[5,6],[7,6],[1,7],[3,7],[5,7],[7,7],[9,7],[3,9],[5,9],[7,9]])this.grid[z][x]=2;
 this.player={x:1,z:1};this.enemies=[{x:9,z:1,clock:0},{x:9,z:9,clock:.2}];this.bombs=[];this.flames=[];this.events=[];this.time=90;this.score=0;this.state='ready';this.ai=0;}
 walkable(x,z){return this.grid[z]?.[x]===0&&!this.bombs.some(b=>b.x===x&&b.z===z)}
 move(dx,dz){if(this.state!=='playing')return;let x=this.player.x+dx,z=this.player.z+dz;if(this.walkable(x,z)){this.player.x=x;this.player.z=z;this.events.push({type:"step"});this.hit();}}
 place(){if(this.state!=='playing'||this.bombs.length>=3||this.bombs.some(b=>b.x===this.player.x&&b.z===this.player.z))return;this.bombs.push({...this.player,t:2});this.events.push({type:"place"});}
 rays(b){let cells=[[b.x,b.z]];for(const [dx,dz] of DIRS)for(let i=1;i<=3;i++){let x=b.x+dx*i,z=b.z+dz*i;if(this.grid[z]?.[x]===undefined||this.grid[z][x]===1)break;cells.push([x,z]);if(this.grid[z][x]===2)break;}return cells;}
 explode(b){if(!this.bombs.includes(b))return;let cells=this.rays(b);this.bombs.splice(this.bombs.indexOf(b),1);this.events.push({type:'blast',x:b.x,z:b.z});for(const [x,z] of cells){this.flames.push({x,z,t:.55});if(this.grid[z][x]===2){this.grid[z][x]=0;this.score+=50;this.events.push({type:'crate',x,z});}let other=this.bombs.find(q=>q.x===x&&q.z===z);if(other)this.explode(other);}}
 hit(){if(this.state!=='playing')return;const hot=p=>this.flames.some(f=>f.x===p.x&&f.z===p.z);const enemyCount=this.enemies.length;this.enemies=this.enemies.filter(e=>{if(hot(e)){this.score+=500;this.events.push({type:'enemy',x:e.x,z:e.z});return false;}return true;});if(enemyCount&&!this.enemies.length)this.events.push({type:'exit'});if(hot(this.player)||this.enemies.some(e=>e.x===this.player.x&&e.z===this.player.z)){this.state='lost';return;}if(!this.enemies.length&&this.player.x===9&&this.player.z===9){this.score+=Math.ceil(this.time)*10;this.state='won';}}
 tick(dt){if(this.state!=='playing')return;const oldSecond=Math.ceil(this.time);this.time=Math.max(0,this.time-dt);if(Math.ceil(this.time)!==oldSecond&&this.time>0&&this.time<=10)this.events.push({type:'warning'});if(!this.time){this.state='lost';return;}this.flames=this.flames.filter(f=>(f.t-=dt)>0);for(const b of [...this.bombs]){const before=b.t;b.t-=dt;for(const threshold of [1.5,1,.6,.35,.15])if(before>threshold&&b.t<=threshold&&b.t>0)this.events.push({type:threshold<.7?'urgent':'tick'});if(b.t<=0)this.explode(b);}this.hit();if(this.state!=='playing')return;
 const danger=new Set(this.flames.map(f=>`${f.x},${f.z}`));for(const b of this.bombs)for(const [x,z] of this.rays(b))danger.add(`${x},${z}`);
 for(const e of this.enemies){e.clock-=dt;if(e.clock>0)continue;e.clock=.48;let queue=[{x:e.x,z:e.z,path:[]}],seen=new Set([`${e.x},${e.z}`]),escape=danger.has(`${e.x},${e.z}`),step;
 while(queue.length){let p=queue.shift();if(p.path.length&& (escape?!danger.has(`${p.x},${p.z}`):(p.x===this.player.x&&p.z===this.player.z))){step=p.path[0];break;}for(const [dx,dz] of DIRS){let x=p.x+dx,z=p.z+dz,k=`${x},${z}`;if(seen.has(k)||!this.walkable(x,z)||(!escape&&danger.has(k))||this.enemies.some(o=>o!==e&&o.x===x&&o.z===z))continue;seen.add(k);queue.push({x,z,path:[...p.path,[x,z]]});}}
 if(step){e.x=step[0];e.z=step[1];this.events.push({type:"enemyStep"});}}
 this.hit();}
}
