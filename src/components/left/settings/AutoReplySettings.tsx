import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import Button from '../../ui/Button';

type OwnProps = {
  onReset: () => void;
};

const AutoReplySettings: FC<OwnProps> = ({ onReset }) => {
  return (
    <div className="settings-content custom-scroll">
      <div className="settings-header">
        <Button round color="translucent" size="smaller" ariaLabel="Back" onClick={onReset}>
          <i className="icon-arrow-left" />
        </Button>
        <h3 className="settings-header-title">Auto-Reply Test</h3>
      </div>
      
      <div className="settings-item" style={{ padding: '30px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-text)' }}>✅ Routing အလုပ်လုပ်ပါသည်!</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '10px' }}>
          ဒီစာသားကို မြင်ရရင် အချိတ်အဆက် အားလုံးမှန်ကန်သွားပါပြီ။
        </p>
      </div>
    </div>
  );
};

export default memo(AutoReplySettings);
