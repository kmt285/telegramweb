import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import useLang from '../../../hooks/useLang';

import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
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
  const { showNotification } = getActions();
  
  const [isEnabled, setIsEnabled] = useState(false);
  const [replyText, setReplyText] = useState("ယခု မအားသေးပါ။ နောက်မှ ပြန်ဆက်သွယ်ပါမည်။");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!currentUserId) {
      alert("User ID not found!");
      return;
    }
    setIsSaving(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/update_auto_reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          user_id: currentUserId,
          enabled: isEnabled,
          text: replyText
        })
      });

      // 🌟 Backend က ပြန်ပို့တဲ့ Error စာသားအမှန်ကို ဖတ်မည့်အပိုင်း 🌟
      const data = await response.json();

      if (response.ok) {
        alert("Auto-Reply settings saved successfully!");
      } else {
        // Error အတိအကျကို Alert ပြပေးမည်
        alert("Server Error: " + (data.error || "Unknown error occurred"));
      }
    } catch (err: any) {
      alert("Network Error: Backend သို့ ချိတ်ဆက်၍ မရပါ။\n" + err.message);
    } finally {
      setIsSaving(false);
    }
  }, [currentUserId, isEnabled, replyText]);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        <Button round color="translucent" size="smaller" ariaLabel={lang('Back')} onClick={onReset}>
          <i className="icon-arrow-left" />
        </Button>
        <h3 className="settings-header-title">Auto-Reply Settings</h3>
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir="auto">Activation</h4>
        <ListItem ripple={false}>
          <Checkbox
            checked={isEnabled}
            label="Enable Auto-Reply"
            onChange={() => setIsEnabled(!isEnabled)}
          />
        </ListItem>
        <p className="settings-item-description">
          When enabled, your account will automatically reply to incoming private messages.
        </p>
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir="auto">Custom Message</h4>
        <div className="settings-item-description" style={{ padding: '0 1rem', marginBottom: '1rem' }}>
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
              resize: 'none'
            }}
          />
        </div>
      </div>

      <div className="settings-item" style={{ padding: '1rem' }}>
        <Button onClick={handleSave} isLoading={isSaving} style={{ width: '100%' }}>
          Save Settings
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
