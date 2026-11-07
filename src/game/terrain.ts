import terrainSheet from '@/assets/terrain-sheet.jpg';
export async function loadTerrain() {
  const image=new Image();image.src=terrainSheet;await image.decode();
  return Array.from({length:4},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');if(!ctx)return new Uint32Array(128*128);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,(i%2)*512,Math.floor(i/2)*512,512,512,0,0,128,128);return new Uint32Array(ctx.getImageData(0,0,128,128).data.buffer.slice(0));});
}