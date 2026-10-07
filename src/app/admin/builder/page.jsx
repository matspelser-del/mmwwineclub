'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { rand } from '@/lib/format';

const BOX_PRICE = 2500;
const ccFee = (p)=> p*0.034 + 2;   // 3.4% + R2

export default function Builder(){
  const [token,setToken]=useState(null);
  const [boxes,setBoxes]=useState([]);
  const [items,setItems]=useState([]);
  const [wines,setWines]=useState([]);
  const [activeMembers,setActiveMembers]=useState(0);
  const [boxId,setBoxId]=useState('');
  const [loading,setLoading]=useState(true);
  const [members,setMembers]=useState(0);     // editable count for projections
  const [pick,setPick]=useState('');          // selected catalogue wine to add
  const [custom,setCustom]=useState({name:'',vintage:'',cost_price:'',cellar_price:'',qty:1,producer:'other'});

  async function load(){
    const { data:s }=await supabase.auth.getSession(); const t=s.session?.access_token; setToken(t);
    const res=await fetch('/api/admin/boxes',{headers:{Authorization:`Bearer ${t}`}});
    const j=await res.json();
    setBoxes(j.boxes||[]); setItems(j.items||[]); setWines(j.wines||[]); setActiveMembers(j.activeMembers||0);
    setMembers(j.activeMembers||0);
    if(!boxId && j.boxes?.length) setBoxId(j.boxes[0].id);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  const box=boxes.find(b=>b.id===boxId);
  const rows=items.filter(i=>i.box_id===boxId);

  async function addFromCatalogue(){
    const w=wines.find(x=>x.id===pick); if(!w||!boxId) return;
    const res=await fetch('/api/admin/box-items',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({box_id:boxId,kind:'wine',producer:w.producer,name:w.name,vintage:w.vintage,qty:1,cost_price:w.cost_price,cellar_price:w.cellar_price})});
    const j=await res.json(); setItems(it=>[...it,j.item]); setPick('');
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
    return {wineCost,extrasCost,cellarValue,delivery,cc,totalCost,profit,margin,
      turnover:BOX_PRICE*n, totalCostAll:totalCost*n, totalProfit:profit*n};
  },[rows,box,members]);

  if(loading) return <div className="loader-full" style={{minHeight:'50vh'}}><div className="session-spinner" /></div>;

  return (
    <>
      <div className="head"><h1>Box Builder</h1><p>Build a box, see the cost and the profit per member and across the club.</p></div>

      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
        <label className="field" style={{margin:0}}>Box</label>
        <select className="select" style={{maxWidth:220}} value={boxId} onChange={e=>setBoxId(e.target.value)}>
          {boxes.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <label className="field" style={{margin:'0 0 0 16px'}}>Members for projection</label>
        <input className="input" style={{width:90}} type="number" value={members} onChange={e=>setMembers(e.target.value)} />
        <span className="hint">{activeMembers} active now</span>
      </div>

      <div className="builder">
        <div className="card">
          <div className="pad" style={{paddingBottom:0}}><h3>In the box</h3></div>
          <div className="rows">
            <div className="rowh" style={{gridTemplateColumns:'1.6fr .6fr .5fr .9fr .9fr auto'}}><div>Item</div><div>From</div><div>Qty</div><div className="r">Cost</div><div className="r">Cellar</div><div></div></div>
            {rows.length===0 && <div className="empty">Nothing added yet. Use the pickers below.</div>}
            {rows.map(r=>(
              <div className="row" key={r.id} style={{gridTemplateColumns:'1.6fr .6fr .5fr .9fr .9fr auto'}}>
                <div><div className="nm">{r.name}{r.kind==='extra'?' (extra)':''}</div><div className="sub">{r.vintage||''}</div></div>
                <div className="sub">{r.producer==='miles'?'Miles':r.producer==='other'?'Other':'—'}</div>
                <div><input className="input" style={{padding:'6px 8px',width:52}} type="number" min="1" value={r.qty} onChange={e=>patchItem(r.id,{qty:Number(e.target.value)||1})} /></div>
                <div className="r"><input className="input" style={{padding:'6px 8px',width:84,textAlign:'right'}} type="number" value={r.cost_price} onChange={e=>patchItem(r.id,{cost_price:Number(e.target.value)||0})} /></div>
                <div className="r"><input className="input" style={{padding:'6px 8px',width:84,textAlign:'right'}} type="number" value={r.cellar_price} onChange={e=>patchItem(r.id,{cellar_price:Number(e.target.value)||0})} /></div>
                <div className="r"><button className="x" onClick={()=>delItem(r.id)}>×</button></div>
              </div>
            ))}
          </div>

          <div className="pad" style={{borderTop:'1px solid var(--line)'}}>
            <div className="grp" style={{marginTop:0}}>Add a Miles wine</div>
            <div style={{display:'flex',gap:8}}>
              <select className="select" value={pick} onChange={e=>setPick(e.target.value)}>
                <option value="">Choose from the range…</option>
                {wines.filter(w=>w.active).map(w=><option key={w.id} value={w.id}>{w.producer==='miles'?'':'(other) '}{w.name}{w.vintage?` ${w.vintage}`:''}</option>)}
              </select>
              <button className="btn sm" onClick={addFromCatalogue} disabled={!pick}>Add</button>
            </div>

            <div className="grp">Add another wine or an extra</div>
            <div className="r2" style={{marginBottom:8}}>
              <input className="input" placeholder="Name" value={custom.name} onChange={e=>setCustom({...custom,name:e.target.value})} />
              <input className="input" placeholder="Vintage (optional)" value={custom.vintage} onChange={e=>setCustom({...custom,vintage:e.target.value})} />
            </div>
            <div className="r2" style={{marginBottom:8}}>
              <input className="input" type="number" placeholder="Cost price" value={custom.cost_price} onChange={e=>setCustom({...custom,cost_price:e.target.value})} />
              <input className="input" type="number" placeholder="Cellar price" value={custom.cellar_price} onChange={e=>setCustom({...custom,cellar_price:e.target.value})} />
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input className="input" style={{width:70}} type="number" min="1" value={custom.qty} onChange={e=>setCustom({...custom,qty:e.target.value})} />
              <button className="btn ghost sm" onClick={()=>addCustom('wine')} disabled={!custom.name}>Add wine</button>
              <button className="btn ghost sm" onClick={()=>addCustom('extra')} disabled={!custom.name}>Add as extra</button>
            </div>
          </div>
        </div>

        <div className="card pad">
          <h3>Per box</h3>
          <div className="rows">
            <L k="Member pays" v={rand(BOX_PRICE)} />
            <L k="Wine cost" v={rand(calc.wineCost)} />
            {calc.extrasCost>0 && <L k="Extras" v={rand(calc.extrasCost)} />}
            <div className="row" style={{gridTemplateColumns:'1fr auto'}}><div className="muted">Delivery</div>
              <div className="r"><input className="input" style={{padding:'4px 8px',width:84,textAlign:'right'}} type="number" value={box?.delivery_fee||0} onChange={e=>patchDelivery(e.target.value)} /></div></div>
            <L k="Card fee (3.4% + R2)" v={rand(calc.cc)} />
            <L k="Total cost" v={rand(calc.totalCost)} bold />
          </div>
          <div style={{marginTop:14,padding:16,borderRadius:12,background:calc.profit>=0?'var(--green-soft)':'var(--red-soft)',color:calc.profit>=0?'var(--green)':'var(--red)'}}>
            <div style={{fontSize:13,fontWeight:600}}>Profit per box</div>
            <div style={{fontSize:26,fontWeight:700,fontFamily:'var(--serif)'}}>{rand(calc.profit)} <span style={{fontSize:14}}>({calc.margin.toFixed(0)}%)</span></div>
          </div>
          <p className="hint" style={{marginTop:10}}>Cellar-door value in the box: <b>{rand(calc.cellarValue)}</b> — what a member gets for their {rand(BOX_PRICE)}.</p>

          <div className="grp">Across {members} members</div>
          <div className="rows">
            <L k="Turnover" v={rand(calc.turnover)} />
            <L k="Total cost" v={rand(calc.totalCostAll)} />
            <L k="Total profit" v={rand(calc.totalProfit)} bold />
          </div>
        </div>
      </div>
    </>
  );
}
function L({k,v,bold}){ return <div className="row" style={{gridTemplateColumns:'1fr auto'}}><div className={bold?'nm':'muted'}>{k}</div><div className={'r '+(bold?'nm':'')}>{v}</div></div>; }
