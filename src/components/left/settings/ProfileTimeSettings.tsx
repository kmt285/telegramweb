import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useEffect } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';
import Button from '../../ui/Button';

const BACKEND_URL = "https://kmt285476-telegram.hf.space"; 
const API_KEY = "tg_custom_secret_key_2026";

type OwnProps = { onReset: () => void; };
type StateProps = { 
  currentUserId?: string;
  firstName?: string;
  lastName?: string;
};

const ProfileTimeSettings: FC<OwnProps & StateProps> = ({ currentUserId, firstName, lastName }) => {
  const safeUserId = currentUserId || "unknown";
  
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true); // 🌟 Data လှမ်းယူနေစဉ် စောင့်ရန်
  const [errorMsg, setErrorMsg] = useState('');

  // 🌟 (၁) ဝင်ဝင်ချင်း Database ကနေ လက်ရှိအခြေအနေကို လှမ်းယူမည် 🌟
  useEffect(() => {
    if (safeUserId === "unknown") return;
    const fetchState = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/get_profile_time`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ user_id: safeUserId })
        });
        const data = await res.json();
        if (res.ok) setIsEnabled(data.enabled);
      } catch (err) {
        console.error(err);
      } finally {
        setIsFetching(false);
      }
    };
    fetchState();
  }, [safeUserId]);
  
  const handleSave = async (newState: boolean) => {
    setIsLoading(true);
    try {
      const cleanLastName = lastName?.replace(/~\s\d{1,2}:\d{2}\s[AM|PM]+/g, '').trim();

      const res = await fetch(`${BACKEND_URL}/api/update_profile_time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ 
          user_id: safeUserId, 
          enabled: newState,
          base_first_name: firstName, 
          base_last_name: cleanLastName
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsEnabled(newState);
        setErrorMsg('');
      } else {
        // Server ချိတ်ထားခြင်းမရှိရင် Error ပြမည်
        setErrorMsg(data.error || 'Failed to update. Make sure Server is connected.');
      }
    } catch (err) {
      setErrorMsg('Network Error.');
    }
    setIsLoading(false);
  };

  if (isFetching) return null; // Data မရသေးခင် အလွတ်ပြထားမည်

  return (
    <div className="settings-content custom-scroll">
      <div className="ar-wrapper">
        <div className="ar-card" onClick={() => !isLoading && handleSave(!isEnabled)}>
          <div className="ar-text-col">
            <div className="ar-title">Profile Time</div>
            <div className="ar-desc">
              Show current time next to your name.
            </div>
          </div>
          <div className={`ar-switch ${isEnabled ? 'on' : ''}`}>
            <div className="ar-switch-thumb"></div>
          </div>
        </div>

        {errorMsg && <div className="ar-error">{errorMsg}</div>}

        <div style={{ marginTop: '0.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Timezone: Myanmar Time (Asia/Yangon)<br/>
          Updates automatically every 60-90 seconds.
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => { 
    const { currentUserId, users } = global;
    const currentUser = currentUserId ? users?.byId?.[currentUserId] : undefined;
    return { 
        currentUserId, 
        firstName: currentUser?.firstName,
        lastName: currentUser?.lastName
    }; 
})(ProfileTimeSettings));
