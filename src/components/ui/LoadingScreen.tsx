export function LoadingScreen() {
  const lines = ['100%', '85%', '95%', '60%', '100%', '90%', '75%'];

  return (
    <>
      <style>{`
        @keyframes writeLine {
          0% { width: 0%; opacity: 0.2; }
          100% { width: var(--target-width); opacity: 1; }
        }
        .animate-write {
          animation: writeLine 1.5s ease-out forwards;
          animation-iteration-count: infinite;
        }
      `}</style>

      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
        {/* Paper (A4 mockup) */}
        <div className="relative w-[90px] h-[126px] bg-white dark:bg-white rounded shadow-2xl p-2 flex flex-col gap-1.5 overflow-hidden">
          {/* Header row: logo placeholder + name line */}
          <div className="flex items-center gap-1 mb-0.5">
            <div className="w-[18px] h-[18px] bg-slate-200 dark:bg-slate-200 rounded-sm shrink-0" />
            <div
              className="h-1 bg-slate-300 rounded-full animate-write origin-left"
              style={
                {
                  '--target-width': '60%',
                  animationDelay: '0s',
                } as React.CSSProperties
              }
            />
          </div>

          {/* Skeleton lines */}
          {lines.map((width, i) => (
            <div
              key={i}
              className="h-1 bg-slate-300 rounded-full animate-write origin-left"
              style={
                {
                  '--target-width': width,
                  animationDelay: `${i * 0.2}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <p className="mt-8 text-slate-500 dark:text-slate-400 font-medium tracking-wide animate-pulse">
          Arbeitsblatt wird generiert…
        </p>
      </div>
    </>
  );
}
