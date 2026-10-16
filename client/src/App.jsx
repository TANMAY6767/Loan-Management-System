import { useEffect, useState } from 'react'

export default function App() {
  const [apiStatus, setApiStatus] = useState('Checking API…')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable')
        return response.json()
      })
      .then((data) => setApiStatus(`API ${data.status}`))
      .catch(() => setApiStatus('Start the server to connect'))
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Starter workspace
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Your app is ready to grow.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
          React and Tailwind run in the client. The Express API and Prisma database live in the server.
        </p>
        <div className="mt-10 inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <span className="size-2.5 rounded-full bg-indigo-500" />
          <span className="font-medium">{apiStatus}</span>
        </div>
      </div>
    </main>
  )
}
