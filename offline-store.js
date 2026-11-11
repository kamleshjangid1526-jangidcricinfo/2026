/* Durable same-device storage shared by Control Board, Score Layer and Scoreboard. */
(() => {
  const DB_NAME='jangid-cricinfo-offline-v1';
  const STORE='records';
  const memory=new Map();
  let dbPromise;
  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return resolve(null);
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Offline storage unavailable'));
      request.onblocked=()=>reject(new Error('Offline storage upgrade is blocked'));
    }).catch(()=>null);
    return dbPromise;
  }
  async function get(key){
    const db=await openDb();
    if(!db)return memory.has(key)?structuredCloneSafe(memory.get(key)):null;
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(String(key));request.onsuccess=()=>resolve(request.result?.value??null);request.onerror=()=>reject(request.error);});}
    catch{return memory.has(key)?structuredCloneSafe(memory.get(key)):null;}
  }
  async function put(key,value){
    const safeValue=structuredCloneSafe(value);memory.set(String(key),safeValue);
    const db=await openDb();if(!db)return false;
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key:String(key),value:safeValue});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Offline save aborted'));});return true;}
    catch{return false;}
  }
  async function remove(key){
    memory.delete(String(key));const db=await openDb();if(!db)return;
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(String(key));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch{}
  }
  async function all(prefix=''){
    const db=await openDb();
    if(!db)return [...memory.entries()].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value:structuredCloneSafe(value)}));
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly'),objectStore=tx.objectStore(STORE);
      // The store's primary key is the record key, so a bounded range reads only this queue.
      // This avoids loading cached account and public-match data during every sync check.
      const range=prefix?IDBKeyRange.bound(String(prefix),String(prefix)+'\uffff'):null;
      const request=range?objectStore.getAll(range):objectStore.getAll();
      request.onsuccess=()=>resolve((request.result||[]).filter(x=>String(x.key).startsWith(prefix)));
      request.onerror=()=>reject(request.error);
    });}
    catch{return [...memory.entries()].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value:structuredCloneSafe(value)}));}
  }
  function structuredCloneSafe(value){try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value??null));}}
  window.JangidOfflineStore={get,put,remove,all,ready:()=>openDb().then(db=>!!db),clone:structuredCloneSafe};
})();