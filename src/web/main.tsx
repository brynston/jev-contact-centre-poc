import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ApiHealth, ContactCentreInteraction, LlmMode, ProviderResult } from '../shared/types';
import './styles.css';

function ProbList({values}:{values:Record<string,number>}){
  return <div className="probs">{Object.entries(values).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k}><span>{k}</span><strong>{(v*100).toFixed(1)}%</strong></div>)}</div>;
}
function ResultCard({title,result,error}:{title:string,result?:ProviderResult,error?:string}){
  if(error) return <section className="card"><h3>{title}</h3><div className="error">{error}</div></section>;
  if(!result) return <section className="card muted"><h3>{title}</h3><p>Not run yet.</p></section>;
  const o=result.output;
  return <section className="card">
    <div className="cardhead"><h3>{title}</h3><span>{result.model}</span></div>
    <div className="metric"><label>Route</label><b>{o.route}</b><ProbList values={o.routeProbabilities}/></div>
    <div className="metric"><label>Urgency</label><b>{o.urgency}</b><ProbList values={o.urgencyProbabilities}/></div>
    <div className="metric"><label>Churn risk</label><b>{o.churnRisk}</b><ProbList values={o.churnProbabilities}/></div>
    <div className="metric"><label>Fraud risk</label><b>{o.fraudRisk}</b><ProbList values={o.fraudProbabilities}/></div>
    <div className="metric"><label>Human escalation</label><b>{o.humanEscalation?'yes':'no'} ({(o.humanEscalationProbability*100).toFixed(1)}%)</b></div>
    <div className="metric"><label>Customer value</label><b>{o.customerValue}</b><ProbList values={o.customerValueProbabilities}/></div>
    <div className="foot">{result.latencyMs.toFixed(0)} ms · {result.inputTokens ?? '—'} input tokens · ${(result.estimatedCostUsd ?? 0).toFixed(6)}</div>
  </section>;
}

function App(){
  const [loadError,setLoadError]=useState('');
  const [items,setItems]=useState<ContactCentreInteraction[]>([]);
  const [index,setIndex]=useState(0);
  const [draft,setDraft]=useState<ContactCentreInteraction|null>(null);
  const [health,setHealth]=useState<ApiHealth|null>(null);
  const [llmMode,setLlmMode]=useState<LlmMode>('direct');
  const [models,setModels]=useState<Record<LlmMode,string>>({direct:'',openrouter:''});
  const [jev,setJev]=useState<ProviderResult>(); const [llm,setLlm]=useState<ProviderResult>();
  const [jevErr,setJevErr]=useState(''); const [llmErr,setLlmErr]=useState(''); const [busy,setBusy]=useState('');

  useEffect(()=>{ Promise.all(['/api/interactions','/api/health'].map(async url=>{const r=await fetch(url);const body=await r.json();if(!r.ok)throw new Error(body.error||'Unable to load the workbench.');return body;})).then(([x,h])=>{setItems(x);setDraft(x[0]);setHealth(h);setLlmMode(h.llm.defaultMode);setModels({direct:h.llm.direct.model,openrouter:h.llm.openrouter.model});}).catch(e=>setLoadError(e.message)); },[]);
  const gt=useMemo(()=>draft?.groundTruth,[draft]);
  function choose(i:number){setIndex(i);setDraft(structuredClone(items[i]));setJev(undefined);setLlm(undefined);setJevErr('');setLlmErr('');}
  function selectMode(mode:LlmMode){setLlmMode(mode);setLlm(undefined);setLlmErr('');}
  function selectModel(model:string){setModels({...models,[llmMode]:model});setLlm(undefined);setLlmErr('');}
  const comparatorName=llmMode==='openrouter'?'OpenRouter':'Direct APIs';
  const comparatorReady=health?.llm[llmMode].configured;
  async function run(provider:'jev'|'llm'){
    if(!draft)return; setBusy(provider); provider==='jev'?setJevErr(''):setLlmErr('');
    const query=provider==='llm'?`?${new URLSearchParams({mode:llmMode,model:models[llmMode].trim()})}`:'';
    try{ const r=await fetch(`/api/run/${provider}${query}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)}); const body=await r.json(); if(!r.ok) throw new Error(body.error||'Request failed'); provider==='jev'?setJev(body):setLlm(body); }
    catch(e:any){provider==='jev'?setJevErr(e.message):setLlmErr(e.message)} finally{setBusy('')}
  }
  if(loadError)return <div className="loading error" role="alert">{loadError}</div>;
  if(!draft)return <div className="loading">Loading…</div>;
  return <main>
    <header><div><h1>Jev Contact Centre Lab</h1><p>{items.length.toLocaleString()} labelled synthetic interactions · edit state · compare typed decisions.</p></div><div className="status"><span className={health?.jevConfigured?'ok':'off'}>Jev {health?.jevConfigured?'ready':'no key'}</span><span className={comparatorReady?'ok':'off'}>{comparatorName} {comparatorReady?'ready':'no key'}</span></div></header>
    <div className="layout">
      <aside><label>Interaction</label><select disabled={!!busy} value={index} onChange={e=>choose(Number(e.target.value))}>{items.map((x,i)=><option key={x.id} value={i}>{x.id} · {x.groundTruth.route} · {x.subject}</option>)}</select>
        <div className="truth"><h3>Ground truth</h3>{gt&&Object.entries(gt).map(([k,v])=><div key={k}><span>{k}</span><b>{String(v)}</b></div>)}</div>
      </aside>
      <section className="editor card"><div className="grid2"><div><label>Subject</label><input value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})}/></div><div><label>Channel</label><select value={draft.channel} onChange={e=>setDraft({...draft,channel:e.target.value as any})}><option>chat</option><option>email</option><option>call_transcript</option></select></div></div>
        <label>Interaction text</label><textarea value={draft.message} onChange={e=>setDraft({...draft,message:e.target.value})}/>
        <label>Metadata</label><pre>{JSON.stringify(draft.metadata,null,2)}</pre>
        <fieldset className="comparator" disabled={!!busy}>
          <legend>Model comparator</legend>
          <div className="provider-toggle" role="group" aria-label="LLM provider mode">
            <label><input type="radio" name="llm-mode" value="direct" checked={llmMode==='direct'} onChange={()=>selectMode('direct')}/> Direct APIs</label>
            <label><input type="radio" name="llm-mode" value="openrouter" checked={llmMode==='openrouter'} onChange={()=>selectMode('openrouter')}/> OpenRouter</label>
          </div>
          <label htmlFor="llm-model">Model</label>
          <select id="llm-model" value={models[llmMode]} onChange={e=>selectModel(e.target.value)}>
            {health?.llm[llmMode].models.map(model=><option key={model} value={model}>{model}</option>)}
          </select>
          <p className="comparator-help">{llmMode==='openrouter'?'Models come from OPENROUTER_MODELS in .env. Clef and Clef Flash use typed decisions automatically.':'Models come from LLM_MODELS in .env and use the server-configured direct API.'} {comparatorReady?'Key configured on the server.':`Add ${llmMode==='openrouter'?'OPENROUTER_API_KEY':'LLM_API_KEY or OPENAI_API_KEY'} to .env and restart the server.`}</p>
        </fieldset>
        <div className="buttons"><button disabled={!!busy} onClick={()=>run('jev')}>{busy==='jev'?'Running…':'Run Jev'}</button><button className="secondary" disabled={!!busy||!comparatorReady||!models[llmMode].trim()} onClick={()=>run('llm')}>{busy==='llm'?'Running…':`Run ${comparatorName}`}</button></div>
      </section>
    </div>
    <div className="results"><ResultCard title="Jev" result={jev} error={jevErr}/><ResultCard title={`Model comparator · ${comparatorName}`} result={llm} error={llmErr}/></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
