import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';

import './Settings.scss';

const BACKEND_URL = "https://kmt285476-telegram.hf.space"; 
const API_KEY = "tg_custom_secret_key_2026";

type OwnProps = {
  onReset: () => void;
};

type StateProps = {
  currentUserId?: string;
};

const AutoReplySettings: FC<OwnProps & StateProps> = ({ onReset, currentUserId }) => {
  const lang = useLang();
  
  const [isEnabled, setIsEnabled] = useState(() => {
    // 🌟 currentUserId အစစ်ကိုသာ သုံးပါမည် 🌟
    return localStorage.getItem(`ar_enabled_${currentUserId}`) === 'true';
  });
  
  const [replyText, setReplyText] = useState(() => {
    return localStorage.getItem(`ar_text_${currentUserId}`) || "ယခု မအားသေးပါ။ နောက်မှ ပြန်ဆက်သွယ်ပါမည်။";
  });
  
  const [isSaving, setIsSaving] = useState(false);

  // 🌟 Database ထဲက "staff_..." နာမည်နှင့် အတိအကျ ကိုက်ညီအောင် ယူမည့် Function 🌟
  const getBackendUserId = () => {
    try {
        const stateStr = localStorage.getItem('tt-global-state');
        if (stateStr) {
            const state = JSON.parse(stateStr);
            const currentId = state.currentUserId;
            if (currentId && state.users && state.users.byId) {
                const user = state.users.byId[currentId] || state.users.byId[currentId.toString()];
                if (user) return currentId.toString();
            }
        }
    } catch (e) {}
    // Telegram ID အစစ် မရခဲ့ရင် DB ထဲက "staff_xxx" ကိုပဲ အတိအကျ ပြန်ပို့ပေးမည်
    return localStorage.getItem("my_custom_user_id") || currentUserId || "unknown";
  };

  const handleSave = useCallback(async () => {
    if (!currentUserId) return; // 🌟 ID အစစ် မရှိရင် အလုပ်မလုပ်ပါ
    
    setIsSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/update_auto_reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          user_id: currentUserId, // 🌟 DB သို့ ID အစစ်ဖြင့်သာ ပို့ပါမည်
          enabled: isEnabled,
          text: replyText
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem(`ar_enabled_${currentUserId}`, isEnabled.toString());
        localStorage.setItem(`ar_text_${currentUserId}`, replyText);
        alert("Auto-Reply!");
      } else {
        alert("❌ Server Error: " + (data.error || "Unknown error occurred"));
      }
    } catch (err: any) {
      alert("❌ Network Error");
    } finally {
      setIsSaving(false);
    }
  }, [isEnabled, replyText, currentUserId]);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        <Button round color="translucent" size="smaller" ariaLabel={lang('Back')} onClick={onReset}>
          <i className="icon-arrow-left" />
        </Button>
        <h3 className="settings-header-title">Auto-Reply Settings</h3>
      </div>

      <div className="settings-item" style={{ padding: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '1rem' }}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            style={{ width: '20px', height: '20px', marginRight: '15px' }}
          />
          <b style={{ color: 'var(--color-text)' }}>Enable Auto-Reply</b>
        </label>
        <p className="settings-item-description" style={{ marginTop: '10px' }}>
          When enabled, your account will automatically reply to incoming private messages.
        </p>
      </div>

      <div className="settings-item" style={{ padding: '0 1rem' }}>
        <h4 className="settings-item-header" dir="auto" style={{ marginBottom: '10px' }}>Custom Message</h4>
        <textarea
          value={replyText}
          onChange={(e: any) => setReplyText(e.target.value)}
          disabled={!isEnabled}
          rows={4}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid var(--color-borders)',
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            fontSize: '1rem',
            resize: 'none',
            fontFamily: 'inherit'
          }}
        />
      </div>

      <div className="settings-item" style={{ padding: '1rem' }}>
        <Button onClick={handleSave} disabled={isSaving} style={{ width: '100%' }}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      currentUserId: global.currentUserId,
    };
  },
)(AutoReplySettings));
