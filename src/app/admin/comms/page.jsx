'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { shortDate } from '@/lib/format';

export default function Comms(){
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  useEffect(()=>{(async()=>{
    const { data:s }=await supabase.auth.getSession(); const t=s.session?.access_token;
    const res=await fetch('/api/admin/comms',{headers:{Authorization:`Bearer ${t}`}});
    const j=await res.json(); setRows(j.campaigns||[]); if(j.error) setErr(j.error); setLoading(false);
  })();},[]);
  return (
    <>
      <div className="head"><h1>Communications</h1><p>Newsletters sent from Mailchimp to the club.</p></div>
      {loading ? <p className="empty">Loading…</p> : (
        <div className="card">
          <div className="rowh" style={{gridTemplateColumns:'2fr 1fr .8fr .8fr'}}><div>Newsletter</div><div>Sent</div><div className="r">Recipients</div><div className="r">Opens</div></div>
          {rows.length===0 ? <div className="empty">{err?`${err}. Check the Mailchimp key is set.`:'No newsletters sent yet, or Mailchimp isn’t connected.'}</div> :
            rows.map(c=>(
              <div className="row" key={c.id} style={{gridTemplateColumns:'2fr 1fr .8fr .8fr'}}>
                <div className="nm">{c.title}</div>
                <div className="sub">{c.sent?shortDate(c.sent):'—'}</div>
                <div className="r">{c.recipients}</div>
                <div className="r">{c.opens!=null?`${c.opens}%`:'—'}</div>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
