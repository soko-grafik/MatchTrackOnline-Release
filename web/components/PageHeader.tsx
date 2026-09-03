"use client";

interface PageHeaderProps {
  title: string;
  subtitle: React.ReactNode;
  rightElement?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  rightElement,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-4">
      <div>
        <h1 className="text-4xl font-black tracking-tighter text-zinc-100 uppercase italic leading-none">
          {title}
        </h1>
        <p className="text-zinc-500 font-bold mt-2 uppercase tracking-[0.2em] text-[10px]">
          {subtitle}
        </p>
      </div>

      {rightElement && (
        <div className="flex items-center justify-end w-full md:w-auto gap-4">
          {rightElement}
        </div>
      )}
    </header>
  );
}
