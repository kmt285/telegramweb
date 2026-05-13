import React, { useState, useEffect, useCallback } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';
import useLang from '../../../hooks/useLang';

import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import Button from '../../ui/Button';

import './Settings.scss'; // မူရင်း Setting Style ကိုပဲ ယူသုံးမည်

const BACKEND_URL = "https://kmt285476-telegram.hf.space"; 
const API_KEY = "tg_custom_secret_key_2026";

const AutoReplySettings = ({ onReset }: { onReset: () => void }) => {
  const lang = useLang();
  const { showNotification } = getActions();
  
  // လက်ရှိ User ရဲ့ ID ကို Telegram Global State မှ ယူခြင်း
  const global = getGlobal();
  const currentUserId = global.currentUserId;

  const [isEnabled, setIsEnabled] = useState(false);
  const [replyText, setReplyText] = useState("ယခု မအားသေးပါ။ နောက်မှ ပြန်ဆက်သွယ်ပါမည်။");
  const [isSaving, setIsSaving] = useState(false);

  // Save လုပ်မည့် Function
  const handleSave = useCallback(async () => {
    if (!currentUserId) return;
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

      if (response.ok) {
        showNotification({ message: "Auto-Reply settings saved successfully!" });
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      showNotification({ message: "Error saving Auto-Reply settings." });
    } finally {
      setIsSaving(false);
    }
  }, [currentUserId, isEnabled, replyText, showNotification]);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        {/* နောက်ပြန်ဆုတ်မည့် ခလုတ် */}
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
        <div style={{ padding: '0 1rem' }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
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

export default AutoReplySettings;
