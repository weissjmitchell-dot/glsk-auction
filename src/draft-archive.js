import {supabase} from './supabase.js';
// Legacy draft tables are shared across years. Do not load an old room as a
// writable new-year draft. Missing migration keeps pre-rollover behavior.
export async function checkDraftArchive(app,roomCode){
 const {data:room,error:roomError}=await supabase.from('rooms').select('id').eq('code',roomCode).single();
 if(roomError)throw roomError;
 const {data:season,error:seasonError}=await supabase.from('league_seasons').select('id').eq('room_id',room.id).eq('is_current',true).maybeSingle();
 if(seasonError)throw seasonError;
 if(!season)return false;
 const {data:plan,error}=await supabase.from('league_season_draft_plans').select('status').eq('season_id',season.id).maybeSingle();
 if(error){if(['42P01','PGRST205'].includes(error.code))return false;throw error;}
 if(plan?.status!=='preparation')return false;
 app.innerHTML='<div class="login-wrap"><section class="login-card"><div class="login-head"><h1>Draft rooms archived</h1></div><div class="login-body"><p>Season rollover preserved the previous draft results. Next-season player pools and draft rooms must be prepared before drafting resumes.</p><a class="btn btn-primary" href="/league?tab=draft">Return to League Office</a></div></section></div>';
 return true;
}
