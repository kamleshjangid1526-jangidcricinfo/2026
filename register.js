const $=id=>document.getElementById(id);
const api=(u,o={})=>fetch(u,{headers:{'Content-Type':'application/json'},...o}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j});
$('createBtn').onclick=async()=>{
 const fullName=$('fullName').value.trim(),mobile=$('mobile').value.replace(/\D/g,''),email=$('email').value.trim(),address=$('address').value.trim(),password=$('password').value,confirm=$('confirmPassword').value;
 if(!fullName||!mobile||!email||!address||!password){$('msg').textContent='Please complete all required fields.';return}
 if(password!==confirm){$('msg').textContent='Password and Confirm Password must match.';return}
 $('createBtn').disabled=true;$('msg').textContent='Creating your account…';
 try{
  const r=await api('/api/register',{method:'POST',body:JSON.stringify({fullName,mobile,email,address,password})});
  $('msg').innerHTML=`<b>Registered Successfully — ${String(r.user.fullName).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</b><br>Your account has been created. Activation IDs are issued manually by Admin.<br><button id="goLogin" class="btn primary" type="button" style="margin-top:12px">Continue to Login</button>`;
  $('msg').style.color='#86efac';$('goLogin').onclick=()=>location.href='control.html';
  setTimeout(()=>location.href='control.html',5000);
 }catch(e){$('msg').textContent=e.message;$('msg').style.color='#fca5a5';$('createBtn').disabled=false}
};
