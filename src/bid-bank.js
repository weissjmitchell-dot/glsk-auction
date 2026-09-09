const dollars=value=>`$${Number(value).toLocaleString('en-US')}`;
export function bidBankView(bank){
 if(!bank)return '<section class="card office-section"><div class="section-title">Bid Bank</div><p role="status">Bid bank unavailable. Refresh to retry. If this persists, the commissioner should check that the v738 SQL migration is installed.</p></section>';
 if(bank.starting_pool==null)return '<section class="card office-section"><div class="section-title">Bid Bank</div><p>The starting bid pool has not been established for this season.</p></section>';
 const rows=[['Starting pool',bank.starting_pool],['Auction spending',-bank.auction_spent],['Supplemental spending',-bank.supplemental_spent],['Contract release penalties',-bank.contract_penalties]];
 if(bank.other_delta)rows.push(['Other bid activity / corrections',bank.other_delta]);
 return `<section class="card office-section" aria-label="Season bid bank"><div class="section-title">${Number(bank.season_year)} Bid Bank</div><div class="kpi-label">Remaining league bid dollars</div><div class="kpi-value">${dollars(bank.remaining)}</div><div style="margin-top:16px">${rows.map(([label,value])=>`<div class="row between gap-8" style="padding:8px 0;border-bottom:1px solid #e1e6ef"><span>${label}</span><strong>${value<0?'−':''}${dollars(Math.abs(value))}</strong></div>`).join('')}</div><p class="small muted">Updates automatically from recorded bid transactions. Team-to-team bid trades do not change the league total.</p>${bank.difference!==0?`<div class="notice" role="status">Team balances total ${dollars(bank.team_total)}, a ${dollars(Math.abs(bank.difference))} difference from the bid bank. The commissioner can review starting allocations and transaction corrections.</div>`:''}</section>`;
}

import {bidHistory} from './bid-history.js';
const cash=n=>n==null?'—':`$${Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const percent=n=>n==null?'—':`${n>=0?'+':''}${(n*100).toFixed(2)}%`;
function table(headers,rows){return `<div style="overflow-x:auto"><table class="data-table" style="width:100%;min-width:560px"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td style="padding:10px 12px">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
export function historicalBidView(tab='auction'){
 const tabs=[['auction','Auction Stats'],['pool','Bid Pool Size by Year'],['trend','Beginning Bid Trend']];
 if(!tabs.some(([id])=>id===tab))tab='auction';
 const nav=`<div class="row gap-8 wrap" style="margin-bottom:18px" aria-label="Historical data views">${tabs.map(([id,label])=>`<button class="btn ${id===tab?'btn-primary':'btn-outline'}" data-bid-history="${id}" aria-pressed="${id===tab}">${label}</button>`).join('')}</div>`;
 let body='';
 if(tab==='auction')body=`<h2>Auction Stats</h2><p class="small muted">Maximum and average winning bids by position, 2016–2025. Source: Auction Stats, D3:M15.</p>${table(['Year','Position','Maximum bid','Average bid'],bidHistory.auctions.slice().reverse().flatMap(a=>a.positions.map(p=>[a.year,p.position,cash(p.max),cash(p.average)])))}`;
 if(tab==='pool'){
 const rows=bidHistory.annual.filter(a=>a.pool!=null);
 body=`<h2>Bid Pool Size by Year</h2><p class="small muted">End-of-season bid pool before redistribution. These totals differ from beginning balances, which include carryover.</p>${table(['Year','Bid pool','Relative to 2014','Year-over-year'],rows.map((a,i)=>[a.year,cash(a.pool),(a.pool/rows[0].pool*100).toFixed(2)+'%',percent(i?a.pool/rows[i-1].pool-1:null)]))}<p class="small muted">Source: Bid Pool Size by Year, C4:C13, matched to Annual Results by year. Broken 2024–2025 references are reconstructed from Annual Results column I. The 2025 pool is $1,157.00; actual distributions in column N total $1,156.50. The 2026 season is still in progress.</p>`;
 }
 if(tab==='trend')body=`<h2>Beginning Bid Trend</h2>${table(['Year','Beginning bids','Year-over-year'],bidHistory.annual.map((a,i,all)=>[a.year,cash(a.beginning),percent(i?a.beginning/all[i-1].beginning-1:null)]))}<p class="small muted">Source: Beg Bid Trend, B4:C16; verified against Annual Results column G. Historical cents are preserved. The approved 2026 operational starting pool is rounded to $1,247.</p>`;
 return `<section class="card office-section" style="padding:20px">${nav}${body}</section>`;
}
