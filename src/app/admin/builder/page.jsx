'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { rand } from '@/lib/format';

const BOX_PRICE = 2500;
const ccFee = (p)=> p*0.034 + 2;   // 3.4% + R2
const RANGE_ORDER = ['The Family','The Introduction','The Chapters'];

// Composed display name: adds the format for anything that isn't a standard 750ml.
const displayName = (w)=> (w.format && w.format!=='750ml') ? `${w.name} (${w.format})` : w.name;

export default function Builder(){
  const [token,setToken]=useState(null);
  const [boxes,setBoxes]=useState([]);
  const [items,setItems]=useState([]);
  const [wines,setWines]=useState([]);
  const [skips,setSkips]=useState([]);
  const [activeMembers,setActiveMembers]=useState(0);
  const [boxId,setBoxId]=useState('');
  const [loading,setLoading]=useState(true);
  const [members,setMembers]=useState(0);     // editable count for projections
  const [q2,setQ2]=useState('');              // catalogue search
  const [showCustom,setShowCustom]=useState(false);
  const [custom,setCustom]=useState({name:'',vintage:'',cost_price:'',cellar_price:'',qty:1,producer:'other'});

  async function load(){
    const { data:s }=await supabase.auth.getSession(); const t=s.session?.access_token; setToken(t);
    const res=await fetch('/api/admin/boxes',{headers:{Authorization:`Bearer ${t}`}});
    const j=await res.json();
    setBoxes(j.boxes||[]); setItems(j.items||[]); setWines(j.wines||[]); setSkips(j.skips||[]); setActiveMembers(j.activeMembers||0);
    setMembers(j.activeMembers||0);
    if(!boxId && j.boxes?.length) setBoxId(j.boxes[0].id);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  const box=boxes.find(b=>b.id===boxId);
  const rows=items.filter(i=>i.box_id===boxId);

  // how many of a given wine (by composed name) are already in this box
  const inBox=(name)=> rows.filter(r=>r.name===name).reduce((s,r)=>s+Number(r.qty||0),0);

  // group the Miles catalogue by range, filtered by search, ordered
  const groups=useMemo(()=>{
    const q=q2.trim().toLowerCase();
    const list=wines
      .filter(w=>w.active && w.producer==='miles')
      .filter(w=>!q || `${w.name} ${w.vintage||''} ${w.range||''}`.toLowerCase().includes(q))
      .sort((a,b)=>(a.position||0)-(b.position||0));
    const by={};
    for(const w of list){ const r=w.range||'The Range'; (by[r]=by[r]||[]).push(w); }
    const order=[...RANGE_ORDER.filter(r=>by[r]), ...Object.keys(by).filter(r=>!RANGE_ORDER.includes(r))];
    return order.map(r=>({range:r, wines:by[r]}));
  },[wines,q2,rows]);

  async function addFromCatalogue(w){
    if(!boxId) return;
    const name=displayName(w);
    const res=await fetch('/api/admin/box-items',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({box_id:boxId,kind:'wine',producer:'miles',name,vintage:w.vintage,qty:1,cost_price:w.cost_price,cellar_price:w.cellar_price})});
    const j=await res.json(); setItems(it=>[...it,j.item]);
  }
  async function addCustom(kind){
    if(!boxId || !custom.name) return;
    const res=await fetch('/api/admin/box-items',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({box_id:boxId,kind,producer:custom.producer,name:custom.name,vintage:custom.vintage,qty:Number(custom.qty)||1,cost_price:Number(custom.cost_price)||0,cellar_price:Number(custom.cellar_price)||0})});
    const j=await res.json(); setItems(it=>[...it,j.item]); setCustom({name:'',vintage:'',cost_price:'',cellar_price:'',qty:1,producer:'other'});
  }
  async function patchItem(id,patch){
    setItems(it=>it.map(x=>x.id===id?{...x,...patch}:x));
    await fetch('/api/admin/box-items',{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id,...patch})});
  }
  async function delItem(id){
    await fetch(`/api/admin/box-items?id=${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    setItems(it=>it.filter(x=>x.id!==id));
  }
  async function patchDelivery(v){
    await fetch('/api/admin/boxes',{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id:boxId,delivery_fee:Number(v)||0})});
    setBoxes(bs=>bs.map(b=>b.id===boxId?{...b,delivery_fee:Number(v)||0}:b));
  }

  async function printPackingList(){
    if(!boxId || !rows.length){ alert('Add wines to the box first.'); return; }
    const res=await fetch('/api/admin/members',{headers:{Authorization:`Bearer ${token}`}});
    const j=await res.json().catch(()=>({}));
    const skippedIds=new Set(skips.filter(s=>s.box_id===boxId).map(s=>s.member_id));
    const receiving=(j.members||[]).filter(m=>m.status==='active' && !skippedIds.has(m.id));
    const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const label=box?.label||'Box';
    const today=new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'});
    const contents=r=>`${Number(r.qty||0)>1?Number(r.qty)+' × ':'1 × '}${esc(r.name)}${r.vintage?' '+esc(r.vintage):''}${r.kind==='extra'?' (extra)':''}`;

    // totals page
    const totalsRows=rows.map(r=>`<tr><td>${contents(r)}</td><td class="n">${Number(r.qty||0)}</td><td class="n">${receiving.length}</td><td class="n b">${Number(r.qty||0)*receiving.length}</td></tr>`).join('');
    const grand=rows.filter(r=>r.kind==='wine').reduce((s,r)=>s+Number(r.qty||0)*receiving.length,0);
    const totalsPage=`<section class="page">
      <h1>${esc(label)} — packing list</h1>
      <p class="meta">${today} · ${receiving.length} member${receiving.length===1?'':'s'} receiving</p>
      <table><thead><tr><th>Item</th><th class="n">Per box</th><th class="n">Members</th><th class="n">Total to pull</th></tr></thead>
      <tbody>${totalsRows}</tbody>
      <tfoot><tr><td class="b">Total bottles to pull</td><td></td><td></td><td class="n b">${grand}</td></tr></tfoot></table>
    </section>`;

    // member pages, 5 per page
    const card=m=>{
      const addr=[m.addr_line1,m.addr_line2,[m.city,m.postal_code].filter(Boolean).join(' '),m.province].filter(Boolean).map(esc).join(', ');
      const items=rows.map(r=>`<li><span class="box">▢</span> ${contents(r)}</li>`).join('');
      return `<div class="member"><div class="m-top"><div class="m-name">${esc(m.name||'—')}</div><div class="m-contact">${esc(m.phone||'')}</div></div>
        <div class="m-addr">${addr||'— no address on file —'}</div>
        <ul class="m-items">${items}</ul></div>`;
    };
    let memberPages='';
    for(let i=0;i<receiving.length;i+=5){
      memberPages+=`<section class="page"><h2>${esc(label)} — member sheets (${i+1}–${Math.min(i+5,receiving.length)} of ${receiving.length})</h2>${receiving.slice(i,i+5).map(card).join('')}</section>`;
    }
    if(!receiving.length) memberPages=`<section class="page"><p>No active members to pack for.</p></section>`;

    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(label)} packing list</title>
    <style>
      @page{size:A4;margin:16mm}
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;margin:0;font-size:13px}
      .page{page-break-after:always;padding:0}
      .page:last-child{page-break-after:auto}
      h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:0 0 14px;color:#555}
      .meta{color:#666;margin:0 0 18px}
      table{width:100%;border-collapse:collapse;margin-top:8px} th,td{text-align:left;padding:9px 10px;border-bottom:1px solid #ddd}
      th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#666} .n{text-align:right} .b{font-weight:bold}
      tfoot td{border-top:2px solid #333;border-bottom:none;font-size:14px}
      .member{border:1px solid #ccc;border-radius:8px;padding:12px 14px;margin-bottom:10px;break-inside:avoid}
      .m-top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #eee;padding-bottom:6px;margin-bottom:6px}
      .m-name{font-size:16px;font-weight:bold} .m-contact{color:#666;font-size:12px}
      .m-addr{color:#333;margin-bottom:8px} .m-items{list-style:none;margin:0;padding:0}
      .m-items li{padding:3px 0} .box{color:#952B2A;margin-right:6px}
    </style></head><body>${totalsPage}${memberPages}
    <script>window.onload=function(){window.print();}<\/script></body></html>`;

    const w=window.open('','_blank');
    if(!w){ alert('Allow pop-ups to download the packing list.'); return; }
    w.document.write(html); w.document.close();
  }

  const calc=useMemo(()=>{
    const wineCost=rows.filter(r=>r.kind==='wine').reduce((s,r)=>s+Number(r.cost_price||0)*Number(r.qty||0),0);
    const extrasCost=rows.filter(r=>r.kind==='extra').reduce((s,r)=>s+Number(r.cost_price||0)*Number(r.qty||0),0);
    const cellarValue=rows.reduce((s,r)=>s+Number(r.cellar_price||0)*Number(r.qty||0),0);
    const delivery=Number(box?.delivery_fee||0);
    const cc=ccFee(BOX_PRICE);
    const totalCost=wineCost+extrasCost+delivery+cc;
    const profit=BOX_PRICE-totalCost;
    const margin=BOX_PRICE?profit/BOX_PRICE*100:0;
    const n=Number(members)||0;
    const bottles=rows.filter(r=>r.kind==='wine').reduce((s,r)=>s+Number(r.qty||0),0);
    return {wineCost,extrasCost,cellarValue,delivery,cc,totalCost,profit,margin,bottles,
      turnover:BOX_PRICE*n, totalCostAll:totalCost*n, totalProfit:profit*n};
  },[rows,box,members]);

  if(loading) return <div className="loader-full" style={{minHeight:'50vh'}}><div className="session-spinner" /></div>;

  return (
    <>
      <div className="head"><h1>Box Builder</h1><p>Build a box, see the cost and the profit per member and across the club.</p></div>

      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:20,flexWrap:'wrap'}}>
        <label className="field" style={{margin:0}}>Box</label>
        <select className="select" style={{maxWidth:220}} value={boxId} onChange={e=>setBoxId(e.target.value)}>
          {boxes.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <label className="field" style={{margin:'0 0 0 16px'}}>Members for projection</label>
        <input className="input" style={{width:90}} type="number" value={members} onChange={e=>setMembers(e.target.value)} />
        <span className="hint">{activeMembers} active now</span>
      </div>

      <div className="builder">
        <div className="builder-left">

          {/* ---- In the box ---- */}
          <div className="card">
            <div className="pad" style={{paddingBottom:14,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
              <h3>In the box</h3>
              <span className="hint">{calc.bottles} {calc.bottles===1?'bottle':'bottles'}</span>
            </div>
            <div className="bi-head"><div>Item</div><div>From</div><div>Qty</div><div className="bi-num">Cost</div><div className="bi-num">Cellar</div><div></div></div>
            {rows.length===0 && <div className="empty">Nothing added yet. Pick wines below.</div>}
            {rows.map(r=>(
              <div className="bi-row" key={r.id}>
                <div className="bi-name"><div className="nm">{r.name}{r.kind==='extra'?' (extra)':''}</div><div className="sub">{r.vintage||''}</div></div>
                <div><span className="bi-lbl">From</span><span className="sub">{r.producer==='miles'?'Miles':r.producer==='other'?'Other':'—'}</span></div>
                <div><span className="bi-lbl">Qty</span><input className="input" style={{padding:'7px 9px',width:56}} type="number" min="1" value={r.qty} onChange={e=>patchItem(r.id,{qty:Number(e.target.value)||1})} /></div>
                <div className="bi-num"><span className="bi-lbl">Cost (R)</span><input className="input" style={{padding:'7px 9px',width:88,textAlign:'right'}} type="number" value={r.cost_price} onChange={e=>patchItem(r.id,{cost_price:Number(e.target.value)||0})} /></div>
                <div className="bi-num"><span className="bi-lbl">Cellar (R)</span><input className="input" style={{padding:'7px 9px',width:88,textAlign:'right'}} type="number" value={r.cellar_price} onChange={e=>patchItem(r.id,{cellar_price:Number(e.target.value)||0})} /></div>
                <button className="x bi-del" onClick={()=>delItem(r.id)} aria-label="Remove">×</button>
              </div>
            ))}
          </div>

          {/* ---- Add wines ---- */}
          <div className="card pad">
            <div className="pickbar">
              <h3>Add wines</h3>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <input className="input" style={{maxWidth:200}} placeholder="Search the range…" value={q2} onChange={e=>setQ2(e.target.value)} />
                <button className="btn ghost sm" onClick={()=>setShowCustom(v=>!v)}>{showCustom?'Close':'+ Other wine / extra'}</button>
              </div>
            </div>

            {showCustom && (
              <div className="custom-add">
                <div className="grp" style={{marginTop:0}}>Add a wine from another producer, or an extra</div>
                <div className="r2" style={{marginBottom:8}}>
                  <input className="input" placeholder="Name" value={custom.name} onChange={e=>setCustom({...custom,name:e.target.value})} />
                  <input className="input" placeholder="Vintage (optional)" value={custom.vintage} onChange={e=>setCustom({...custom,vintage:e.target.value})} />
                </div>
                <div className="r2" style={{marginBottom:8}}>
                  <input className="input" type="number" placeholder="Cost price" value={custom.cost_price} onChange={e=>setCustom({...custom,cost_price:e.target.value})} />
                  <input className="input" type="number" placeholder="Cellar price" value={custom.cellar_price} onChange={e=>setCustom({...custom,cellar_price:e.target.value})} />
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <label className="field" style={{margin:0}}>Qty</label>
                  <input className="input" style={{width:70}} type="number" min="1" value={custom.qty} onChange={e=>setCustom({...custom,qty:e.target.value})} />
                  <button className="btn ghost sm" onClick={()=>addCustom('wine')} disabled={!custom.name}>Add wine</button>
                  <button className="btn ghost sm" onClick={()=>addCustom('extra')} disabled={!custom.name}>Add as extra</button>
                </div>
              </div>
            )}

            {groups.length===0 && <div className="catalogue-empty">No wines match. Run supabase-wines.sql to load the range, or clear the search.</div>}

            {groups.map(g=>(
              <div key={g.range}>
                <div className="grp" style={{marginTop:14}}>{g.range}</div>
                <div className="catalogue">
                  {g.wines.map(w=>{
                    const n=inBox(displayName(w));
                    return (
                      <button className="wine-pick" key={w.id} onClick={()=>addFromCatalogue(w)}>
                        <div style={{minWidth:0}}>
                          <span className="wp-name">{w.name}</span>
                          <span className="wp-meta">{[w.vintage, w.format, w.note].filter(Boolean).join(' · ')}</span>
                        </div>
                        <div className="wp-right">
                          {n>0 && <span className="wp-inbox">In box · {n}</span>}
                          <span className="wp-price">{w.cellar_price>0?rand(w.cellar_price):'—'}</span>
                          <span className="wp-add">+</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Per box ---- */}
        <div className="card pad">
          <h3>Per box</h3>
          <div className="rows" style={{marginTop:6}}>
            <L k="Member pays" v={rand(BOX_PRICE)} />
            <L k="Wine cost" v={rand(calc.wineCost)} />
            {calc.extrasCost>0 && <L k="Extras" v={rand(calc.extrasCost)} />}
            <div className="row" style={{gridTemplateColumns:'1fr auto'}}><div className="muted">Delivery</div>
              <div className="r"><input className="input" style={{padding:'4px 8px',width:84,textAlign:'right'}} type="number" value={box?.delivery_fee||0} onChange={e=>patchDelivery(e.target.value)} /></div></div>
            <L k="Card fee (3.4% + R2)" v={rand(calc.cc)} />
            <L k="Total cost" v={rand(calc.totalCost)} bold />
          </div>
          <div style={{marginTop:16,padding:'16px 18px',borderRadius:12,background:calc.profit>=0?'var(--green-soft)':'var(--red-soft)',color:calc.profit>=0?'var(--green)':'var(--red)'}}>
            <div style={{fontSize:13,fontWeight:600}}>Profit per box</div>
            <div style={{fontSize:28,fontWeight:700,letterSpacing:'-.02em',marginTop:2}}>{rand(calc.profit)} <span style={{fontSize:14,fontWeight:600}}>({calc.margin.toFixed(0)}%)</span></div>
          </div>
          <p className="hint" style={{marginTop:12}}>Cellar-door value in the box: <b>{rand(calc.cellarValue)}</b> — what a member gets for their {rand(BOX_PRICE)}.</p>

          <div className="grp" style={{marginTop:20}}>Across {members} members</div>
          <div className="rows">
            <L k="Turnover" v={rand(calc.turnover)} />
            <L k="Total cost" v={rand(calc.totalCostAll)} />
            <L k="Total profit" v={rand(calc.totalProfit)} bold />
          </div>

          {(() => {
            const skipsForBox = skips.filter(s=>s.box_id===boxId).length;
            const recv = Math.max(0, (Number(members)||0) - skipsForBox);
            const wineRows = rows.filter(r=>r.kind==='wine');
            const totalBottles = wineRows.reduce((s,r)=>s+Number(r.qty||0)*recv,0);
            return (
              <>
                <div className="grp" style={{marginTop:20,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <span>Packing list</span>
                  <span className="hint" style={{textTransform:'none',letterSpacing:0}}>{recv} receiving{skipsForBox?` · ${skipsForBox} skipped`:''}</span>
                </div>
                {wineRows.length===0 ? <p className="hint">Add wines to see how many bottles to pull.</p> :
                  <>
                    <div className="rows">
                      {wineRows.map(r=>(
                        <div className="row" key={'pk'+r.id} style={{gridTemplateColumns:'1fr auto'}}>
                          <div className="muted">{r.name}{r.vintage?` ${r.vintage}`:''}</div>
                          <div className="r nm">{Number(r.qty||0)*recv}</div>
                        </div>
                      ))}
                      <L k="Total bottles to pull" v={totalBottles} bold />
                    </div>
                    <button className="btn sm" style={{marginTop:14}} onClick={printPackingList}>Download packing list (PDF)</button>
                    <p className="hint" style={{marginTop:6}}>Totals first, then one sheet per member, 5 to a page. Opens a print window - choose "Save as PDF".</p>
                  </>}
              </>
            );
          })()}
        </div>
      </div>
    </>
  );
}
function L({k,v,bold}){ return <div className="row" style={{gridTemplateColumns:'1fr auto'}}><div className={bold?'nm':'muted'}>{k}</div><div className={'r '+(bold?'nm':'')}>{v}</div></div>; }
