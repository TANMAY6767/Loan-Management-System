
import { useState } from 'react';
import { ArrowRight, CircleHelp } from 'lucide-react';

import { login } from '../services/authService.js';

const DEMO_USERS = [
  { label: 'Head', username: 'u001' },
  { label: 'Manager', username: 'manager1' },
  { label: 'Caller', username: 'caller1' },
];

const DEMO_PASSWORD = 'shaha123';

function BrandHeader() {
  return (
    <div className="art-brand">
      <div className="brand-mark">
        S<span>.</span>
      </div>

      <strong>SHAHA FINLEASE</strong>
    </div>
  );
}

function LoginArtwork() {
  return (
    <div className="login-art">
      <BrandHeader />

      <div className="art-copy">
        <div className="eyebrow light">RECOVERY, WITH CLARITY</div>

        <h1>
          Every conversation
          <br />
          moves us forward.
        </h1>

        <p>
          A calmer workspace for your recovery team to keep every
          account, promise and payment on track.
        </p>
      </div>

      <div className="art-footer">
        Shaha Finlease · Recovery Desk
        <span>Prototype workspace</span>
      </div>

      <div className="art-circle circle-one" />
      <div className="art-circle circle-two" />
    </div>
  );
}

function LoginInput({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  placeholder,
}) {
  return (
    <label>
      {label}

      <input
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
      />
    </label>
  );
}

function DemoUserButtons({ onSelectUser }) {
  return (
    <div className="quick-users">
      {DEMO_USERS.map((user) => (
        <button
          key={user.username}
          type="button"
          onClick={() => onSelectUser(user.username)}
        >
          {user.label}
        </button>
      ))}
    </div>
  );
}

function DemoAccess({ onSelectUser }) {
  return (
    <div className="demo-box">
      <div className="demo-icon">
        <CircleHelp size={17} />
      </div>

      <div>
        <strong>Demo access</strong>

        <p>
          Seeded usernames are listed in{' '}
          <code>seed-data/users_seed.csv</code>. Password:{' '}
          <code>{DEMO_PASSWORD}</code>
        </p>

        <DemoUserButtons onSelectUser={onSelectUser} />
      </div>
    </div>
  );
}

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('u001');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const data = await login(username, password);
      onLogin(data);
    } catch (err) {
      setError(err.message || 'Could not connect to the API.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-side">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="eyebrow">WELCOME BACK</div>

        <h2>Sign in to your workspace</h2>

        <p className="login-sub">
          Use your seeded demo account to continue.
        </p>

        <LoginInput
          label="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          placeholder="e.g. caller1"
        />

        <LoginInput
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button
          className="primary-button login-submit"
          type="submit"
          disabled={busy}
        >
          {busy ? 'Signing in…' : 'Sign in'}
          <ArrowRight size={17} />
        </button>

        <DemoAccess onSelectUser={setUsername} />

        <div className="login-legal">
          For learning and demonstration use only.
        </div>
      </form>
    </div>
  );
}

export default function LoginPage({ onLogin }) {
  return (
    <div className="login-page">
      <LoginArtwork />
      <LoginForm onLogin={onLogin} />
    </div>
  );
}

