'use client';

type Props = {
  name:   string;
  emoji:  string;
  href:   string;
  status: 'live' | 'soon';
};

export default function AppCard({ name, emoji, href, status }: Props) {
  const handleOpen = () => {
    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = href;
    }
  };

  return (
    <button
      onClick={status === 'live' ? handleOpen : undefined}
      className={[
        'relative flex flex-col items-center justify-center gap-2',
        'p-5 rounded-2xl border transition-all duration-200 w-full',
        status === 'live'
          ? 'border-[#d4af3730] bg-[#0d0d14] hover:border-[#d4af37] hover:bg-[#1a1208] cursor-pointer'
          : 'border-white/10 bg-[#0d0d14] opacity-40 cursor-default',
      ].join(' ')}
    >
      <span className="text-3xl">{emoji}</span>
      <span className="text-xs font-semibold text-white">{name}</span>
      {status === 'live' && (
        <span className="absolute top-2 right-2 text-[8px] text-emerald-400">●</span>
      )}
    </button>
  );
}
